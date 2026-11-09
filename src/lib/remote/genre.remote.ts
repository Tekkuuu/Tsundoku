import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { genre, series, seriesGenre } from '#lib/server/db/schema.js';
import { isUniqueViolation } from '#lib/server/db/errors.js';
import { logger } from '#lib/server/logger.js';
import {
	DeleteGenreSchema,
	GenreNameSchema,
	UpdateGenreSchema
} from '#lib/shared/validation/genre.js';

/** Get-or-create genre by normalized name. */
export const createGenre = command(GenreNameSchema, async (name) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized genre creation attempt');
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;
	const existing = await db
		.select({ id: genre.id, name: genre.name })
		.from(genre)
		.where(and(eq(genre.userId, userId), sql`lower(btrim(${genre.name})) = lower(btrim(${name}))`))
		.limit(1);

	if (existing.length > 0) {
		return existing[0];
	}

	try {
		const created = (
			await db.insert(genre).values({ userId, name }).returning({ id: genre.id, name: genre.name })
		).at(0);

		if (!created) {
			error(500, 'Genre could not be created');
		}

		return created;
	} catch (err) {
		// Lost insert race; re-read.
		if (isUniqueViolation(err, 'unique_user_genre')) {
			const raced = await db
				.select({ id: genre.id, name: genre.name })
				.from(genre)
				.where(
					and(eq(genre.userId, userId), sql`lower(btrim(${genre.name})) = lower(btrim(${name}))`)
				)
				.limit(1);

			if (raced.length > 0) {
				return raced[0];
			}
		}
		throw err;
	}
});

/** User genres ordered by name. */
export const getGenres = query(async () => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized genre fetch attempt');
		error(401, 'Unauthorized');
	}

	return db
		.select({ id: genre.id, name: genre.name })
		.from(genre)
		.where(eq(genre.userId, locals.user.id))
		.orderBy(asc(genre.name));
});

/** User genres with the number of linked series. */
export const getGenresWithCounts = query(async () => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized genre fetch attempt');
		error(401, 'Unauthorized');
	}

	const rows = await db
		.select({
			id: genre.id,
			name: genre.name,
			seriesCount: count(seriesGenre.seriesId)
		})
		.from(genre)
		.leftJoin(seriesGenre, eq(seriesGenre.genreId, genre.id))
		.where(eq(genre.userId, locals.user.id))
		.groupBy(genre.id)
		.orderBy(asc(genre.name));

	return rows.map((row) => ({ ...row, seriesCount: Number(row.seriesCount) }));
});

/** Rename an owned genre. Normalized name must stay unique per user. */
export const updateGenre = command(UpdateGenreSchema, async ({ id, name }) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized genre rename attempt');
		error(401, 'Unauthorized');
	}

	try {
		const updated = (
			await db
				.update(genre)
				.set({ name })
				.where(and(eq(genre.id, id), eq(genre.userId, locals.user.id)))
				.returning({ id: genre.id, name: genre.name })
		).at(0);

		if (!updated) {
			error(404, 'Genre not found');
		}

		return updated;
	} catch (err) {
		if (isUniqueViolation(err, 'unique_user_genre')) {
			error(409, 'A genre with this name already exists');
		}
		throw err;
	}
});

/** Delete an owned genre. Series links cascade. Returns the detached series count. */
export const deleteGenre = command(DeleteGenreSchema, async ({ id }) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized genre deletion attempt');
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;
	const owned = await db
		.select({ id: genre.id })
		.from(genre)
		.where(and(eq(genre.id, id), eq(genre.userId, userId)))
		.limit(1);

	if (owned.length === 0) {
		error(404, 'Genre not found');
	}

	const links = await db
		.select({ seriesId: seriesGenre.seriesId })
		.from(seriesGenre)
		.innerJoin(genre, eq(genre.id, seriesGenre.genreId))
		.where(and(eq(seriesGenre.genreId, id), eq(genre.userId, userId)));

	await db.delete(genre).where(and(eq(genre.id, id), eq(genre.userId, userId)));

	logger.info({ userId, genreId: id, seriesCount: links.length }, 'Genre deleted');
	return { seriesCount: links.length };
});

/** Library-wide genre stats: per-genre series counts plus ungenred and total series. */
export const getSeriesGenreStats = query(async () => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized genre stats fetch attempt');
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;
	const [genreRows, ungenredRows, totalRows] = await Promise.all([
		db
			.select({
				id: genre.id,
				name: genre.name,
				seriesCount: count(seriesGenre.seriesId)
			})
			.from(genre)
			.leftJoin(seriesGenre, eq(seriesGenre.genreId, genre.id))
			.where(eq(genre.userId, userId))
			.groupBy(genre.id)
			.orderBy(asc(genre.name)),
		db
			.select({ count: count() })
			.from(series)
			.leftJoin(seriesGenre, eq(seriesGenre.seriesId, series.id))
			.where(and(eq(series.userId, userId), isNull(seriesGenre.genreId))),
		db.select({ count: count() }).from(series).where(eq(series.userId, userId))
	]);

	const genres = genreRows.map((row) => ({ ...row, seriesCount: Number(row.seriesCount) }));

	return {
		genres,
		totalLinks: genres.reduce((sum, genre) => sum + genre.seriesCount, 0),
		ungenredSeries: Number(ungenredRows.at(0)?.count ?? 0),
		totalSeries: Number(totalRows.at(0)?.count ?? 0)
	};
});

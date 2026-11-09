import { command, form, getRequestEvent, query } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import {
	and,
	asc,
	count,
	desc,
	eq,
	exists,
	getTableColumns,
	inArray,
	not,
	or,
	sql,
	SQL
} from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { book, genre, series, seriesGenre } from '#lib/server/db/schema.js';
import { isUniqueViolation } from '#lib/server/db/errors.js';
import { logger } from '#lib/server/logger.js';
import {
	CreateSeriesBatchSchema,
	CreateSeriesSchema,
	DeleteSeriesSchema,
	UpdateSeriesSchema,
	UpdateSeriesStatusSchema
} from '#lib/shared/validation/series.js';
import { GenreNameSchema } from '#lib/shared/validation/genre.js';
import { z } from 'zod';
import { similarity, trgmMatch, wordSimilarity } from '#lib/server/db/trgm.js';
import { getSearchTermValue, tokenizeSearchQuery } from '#lib/shared/search.js';
import { findMissingVolumeNumbers } from '#lib/shared/series/missing-volumes.js';

/**
 * @param title Series title.
 * @param author Series author; null maps to empty string.
 * @returns Key matching `unique_user_series_title_author`.
 */
function seriesKey(title: string, author?: string | null): string {
	return `${title.trim().toLowerCase()}\u0000${(author ?? '').trim().toLowerCase()}`;
}

/** Parse comma-separated genre names. Case-insensitive dedupe, first casing wins. */
function parseGenreNames(raw: string): string[] {
	const seen = new Set<string>();
	const names: string[] = [];
	for (const part of raw.split(',')) {
		const name = part.trim();
		if (!name) continue;
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		names.push(name);
	}
	return names;
}

export const createSeries = form(CreateSeriesSchema, async (createdSeries, issue) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized series creation attempt');
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;
	const { genres, ...formData } = createdSeries;
	const genreIds = [...new Set(genres)];

	if (genreIds.length > 0) {
		const ownedGenres = await db
			.select({ id: genre.id })
			.from(genre)
			.where(and(eq(genre.userId, userId), inArray(genre.id, genreIds)));

		if (ownedGenres.length !== genreIds.length) {
			logger.warn({ userId, genreIds }, 'Series creation with unknown genres');
			invalid(issue.genres('One or more selected genres are invalid. Remove them and try again.'));
		}
	}

	let newSeriesId: string | undefined;

	try {
		await db.transaction(async (tx) => {
			const created = (
				await tx
					.insert(series)
					.values({
						title: formData.title.trim(),
						author: formData.author?.trim() || null,
						status: formData.status,
						userId
					})
					.returning({ id: series.id })
			).at(0);

			if (!created) {
				throw new Error('Series insert returned no row');
			}

			newSeriesId = created.id;

			if (genreIds.length > 0) {
				await tx.insert(seriesGenre).values(
					genreIds.map((genreId) => ({
						genreId,
						seriesId: created.id
					}))
				);
			}
		});
	} catch (err) {
		if (isUniqueViolation(err, 'unique_user_series_title_author')) {
			logger.warn({ userId }, 'Duplicate series on create');
			invalid(issue.title('A series with this title and author already exists'));
		}
		throw err;
	}

	logger.info({ userId, seriesId: newSeriesId, genreCount: genreIds.length }, 'Series created');
	redirect(303, `/series/${newSeriesId}`);
});

export const createSeriesBatch = form(CreateSeriesBatchSchema, async (data, issue) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized batch series creation attempt');
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;
	const rows = data.series;

	type InvalidIssue = Parameters<typeof invalid>[number];
	const issues: InvalidIssue[] = [];

	const seen = new Map<string, number>();
	rows.forEach((row, index) => {
		const key = seriesKey(row.title, row.author);
		if (seen.has(key)) {
			issues.push(issue.series[index].title(`"${row.title}" is duplicated above`));
		} else {
			seen.set(key, index);
		}
	});

	const existing = await db
		.select({ title: series.title, author: series.author })
		.from(series)
		.where(eq(series.userId, userId));
	const existingKeys = new Set(existing.map((row) => seriesKey(row.title, row.author)));

	rows.forEach((row, index) => {
		if (existingKeys.has(seriesKey(row.title, row.author))) {
			issues.push(issue.series[index].title(`"${row.title}" already exists`));
		}
	});

	// Reject the batch on the first invalid genre name, before any write.
	const genreNamesPerRow = rows.map((row) => parseGenreNames(row.genres));
	genreNamesPerRow.forEach((names, index) => {
		for (const name of names) {
			const parsed = GenreNameSchema.safeParse(name);
			if (!parsed.success) {
				issues.push(
					issue.series[index].genres(parsed.error.issues[0]?.message ?? 'Invalid genre name')
				);
				break;
			}
		}
	});

	if (issues.length > 0) {
		invalid(...issues);
	}

	const values = rows.map((row) => ({
		userId,
		title: row.title.trim(),
		author: row.author?.trim() ? row.author.trim() : null,
		status: row.status
	}));

	try {
		await db.transaction(async (tx) => {
			// Genre resolution runs inside the transaction; a throw rolls back the batch.
			const allNames = new Map<string, string>();
			for (const names of genreNamesPerRow) {
				for (const name of names) {
					const key = name.trim().toLowerCase();
					if (!allNames.has(key)) allNames.set(key, name.trim());
				}
			}

			let nameToId = new Map<string, string>();
			if (allNames.size > 0) {
				const owned = await tx
					.select({ id: genre.id, name: genre.name })
					.from(genre)
					.where(eq(genre.userId, userId));
				for (const row of owned) {
					nameToId.set(row.name.trim().toLowerCase(), row.id);
				}

				const missing = [...allNames.entries()].filter(([key]) => !nameToId.has(key));
				if (missing.length > 0) {
					await tx
						.insert(genre)
						.values(missing.map(([, name]) => ({ userId, name })))
						.onConflictDoNothing();
					const reread = await tx
						.select({ id: genre.id, name: genre.name })
						.from(genre)
						.where(eq(genre.userId, userId));
					nameToId = new Map(reread.map((row) => [row.name.trim().toLowerCase(), row.id]));
				}
			}

			const createdSeries = await tx.insert(series).values(values).returning({ id: series.id });
			if (createdSeries.length !== values.length) {
				throw new Error('Batch series insert returned incomplete rows');
			}

			const links = createdSeries.flatMap((created, index) => {
				const keys = genreNamesPerRow[index].map((name) => name.trim().toLowerCase());
				return [...new Set(keys)]
					.map((key) => nameToId.get(key))
					.filter((genreId): genreId is string => genreId !== undefined)
					.map((genreId) => ({ genreId, seriesId: created.id }));
			});
			if (links.length > 0) {
				await tx.insert(seriesGenre).values(links);
			}
		});
	} catch (err) {
		if (isUniqueViolation(err, 'unique_user_series_title_author')) {
			logger.warn({ userId }, 'Duplicate series on batch insert');
			invalid('One or more series already exist. Refresh the page and try again.');
		}
		throw err;
	}

	logger.info({ userId, count: values.length }, 'Series created in batch');
});

export const updateSeries = form(UpdateSeriesSchema, async (updatedSeries, issue) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized series update attempt');
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;
	const { id, addGenres, removeGenres, title, author, status } = updatedSeries;

	// IDs in both lists are treated as removals.
	const removeIds = [...new Set(removeGenres ?? [])];
	const removeSet = new Set(removeIds);
	const addIds = [...new Set(addGenres ?? [])].filter((genreId) => !removeSet.has(genreId));
	const touchedGenreIds = [...new Set([...addIds, ...removeIds])];

	if (touchedGenreIds.length > 0) {
		const ownedGenres = await db
			.select({ id: genre.id })
			.from(genre)
			.where(and(eq(genre.userId, userId), inArray(genre.id, touchedGenreIds)));
		const ownedIds = new Set(ownedGenres.map((row) => row.id));

		if (addIds.some((genreId) => !ownedIds.has(genreId))) {
			logger.warn({ userId, seriesId: id, addIds }, 'Series update with unknown genres to add');
			invalid(issue.addGenres('One or more selected genres are invalid. Reload and try again.'));
		}

		if (removeIds.some((genreId) => !ownedIds.has(genreId))) {
			logger.warn(
				{ userId, seriesId: id, removeIds },
				'Series update with unknown genres to remove'
			);
			invalid(issue.removeGenres('One or more selected genres are invalid. Reload and try again.'));
		}
	}

	const updates: Partial<typeof series.$inferInsert> = {};
	if (title !== undefined) updates.title = title.trim();
	if (author !== undefined) updates.author = author.trim() || null;
	if (status !== undefined) updates.status = status;

	const hasFieldUpdates = Object.keys(updates).length > 0;

	if (!hasFieldUpdates && addIds.length === 0 && removeIds.length === 0) {
		return;
	}

	try {
		await db.transaction(async (tx) => {
			const updated = hasFieldUpdates
				? (
						await tx
							.update(series)
							.set(updates)
							.where(and(eq(series.id, id), eq(series.userId, userId)))
							.returning({ id: series.id })
					).at(0)
				: (
						await tx
							.select({ id: series.id })
							.from(series)
							.where(and(eq(series.id, id), eq(series.userId, userId)))
							.limit(1)
					).at(0);

			if (!updated) {
				logger.warn({ userId, seriesId: id }, 'Series update failed - series not found');
				error(404, 'Series not found');
			}

			if (removeIds.length > 0) {
				await tx
					.delete(seriesGenre)
					.where(and(eq(seriesGenre.seriesId, id), inArray(seriesGenre.genreId, removeIds)));
			}

			if (addIds.length > 0) {
				await tx
					.insert(seriesGenre)
					.values(
						addIds.map((genreId) => ({
							genreId,
							seriesId: id
						}))
					)
					.onConflictDoNothing();
			}
		});
	} catch (err) {
		if (isUniqueViolation(err, 'unique_user_series_title_author')) {
			logger.warn({ userId, seriesId: id }, 'Duplicate series on update');
			invalid(issue.title('Another series with this title and author already exists'));
		}
		throw err;
	}

	logger.info(
		{ userId, seriesId: id, added: addIds.length, removed: removeIds.length },
		'Series updated'
	);
});

export const deleteSeries = command(DeleteSeriesSchema, async (deletedSeries) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized series deletion attempt');
		error(401, 'Unauthorized');
	}

	await db
		.delete(series)
		.where(and(eq(series.id, deletedSeries.id), eq(series.userId, locals.user.id)));
});

export const updateSeriesStatus = command(UpdateSeriesStatusSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized series status update attempt');
		error(401, 'Unauthorized');
	}

	await db
		.update(series)
		.set({ status: data.status })
		.where(and(eq(series.id, data.id), eq(series.userId, locals.user.id)));
});

type SeriesSearchTerm = {
	field: string;
	value: string;
	negated: boolean;
};

function parseSeriesSearch(search: string): SeriesSearchTerm[] {
	return tokenizeSearchQuery(search)
		.map((rawTerm) => {
			const { value: positiveTerm, negated } = getSearchTermValue(rawTerm);
			const colon = positiveTerm.indexOf(':');
			const field = colon === -1 ? '' : positiveTerm.slice(0, colon).toLowerCase();
			const rawValue = colon === -1 ? positiveTerm : positiveTerm.slice(colon + 1);
			const value = getSearchTermValue(rawValue.trim()).value;

			return { field, value, negated };
		})
		.filter((term) => term.value !== '');
}

function seriesTermCondition(term: SeriesSearchTerm): SQL {
	const titleMatch = trgmMatch(series.title, term.value);
	const authorMatch = trgmMatch(sql`coalesce(${series.author}, '')`, term.value);
	const genreMatch = exists(
		db
			.select({ one: sql`1` })
			.from(seriesGenre)
			.innerJoin(genre, eq(genre.id, seriesGenre.genreId))
			.where(
				and(
					eq(seriesGenre.seriesId, series.id),
					eq(genre.userId, series.userId),
					trgmMatch(genre.name, term.value)
				)
			)
	);

	let condition: SQL;

	switch (term.field) {
		case 'title':
			condition = titleMatch;
			break;
		case 'author':
			condition = authorMatch;
			break;
		case 'genre':
			condition = genreMatch;
			break;
		case '':
			condition = or(titleMatch, authorMatch, genreMatch) ?? sql`false`;
			break;
		default:
			condition = sql`false`;
	}

	return term.negated ? not(condition) : condition;
}

function seriesSearchScore(terms: SeriesSearchTerm[]): SQL<number> | null {
	const positiveTerms = terms.filter((term) => !term.negated);

	if (positiveTerms.length === 0) {
		return null;
	}

	const parts = positiveTerms.map((term) => {
		const titleScore = sql<number>`greatest(
			${similarity(series.title, term.value)},
			${wordSimilarity(term.value, series.title)}
		)`;
		const authorScore = sql<number>`greatest(
			${similarity(sql`coalesce(${series.author}, '')`, term.value)},
			${wordSimilarity(term.value, sql`coalesce(${series.author}, '')`)}
		)`;
		const genreScore = sql<number>`(
      select coalesce(max(greatest(
        similarity(g.name, ${term.value}),
        word_similarity(${term.value}, g.name)
      )), 0)
      from series_genre sg
      join genre g on g.id = sg.genre_id
      where sg.series_id = ${series.id}
    )`;

		switch (term.field) {
			case 'title':
				return titleScore;
			case 'author':
				return authorScore;
			case 'genre':
				return genreScore;
			case '':
				return sql<number>`greatest(${titleScore}, ${authorScore}, ${genreScore})`;
			default:
				return sql<number>`0`;
		}
	});

	return sql<number>`(${sql.join(parts, sql` + `)})`;
}

export const getSeries = query(
	z.object({
		count: z.number().int().positive(),
		page: z.number().int().positive(),
		search: z.string().trim().optional()
	}),
	async (params) => {
		const { locals } = getRequestEvent();

		if (!locals.user) {
			logger.warn('Unauthorized series fetch attempt');
			error(401, 'Unauthorized');
		}

		const userId = locals.user.id;
		const terms = params.search ? parseSeriesSearch(params.search) : [];
		const where = and(eq(series.userId, userId), ...terms.map(seriesTermCondition));
		const score = terms.length > 0 ? seriesSearchScore(terms) : null;
		const selection = db
			.select({
				...getTableColumns(series),
				genres: sql<
					string[]
				>`coalesce(array_agg(${genre.name}) filter (where ${genre.id} is not null), '{}')`.as(
					'genres'
				)
			})
			.from(series)
			.where(where)
			.leftJoin(seriesGenre, eq(seriesGenre.seriesId, series.id))
			.leftJoin(genre, eq(genre.id, seriesGenre.genreId))
			.groupBy(series.id);
		const pageQuery = score
			? selection.orderBy(desc(score), asc(series.title))
			: selection.orderBy(asc(series.title));

		const [countRows, se] = await Promise.all([
			db.select({ count: count() }).from(series).where(where),
			pageQuery.limit(params.count).offset(params.count * (params.page - 1))
		]);

		const total = Number(countRows.at(0)?.count ?? 0);

		if (se.length === 0) {
			return { seriesEntries: [], total };
		}

		const seriesIds = se.map((s) => s.id);
		const [latestVolumes, genreRows] = await Promise.all([
			db
				.selectDistinctOn([book.seriesId], {
					seriesId: book.seriesId,
					volumeNumber: book.volumeNumber,
					coverFileId: book.coverFileId
				})
				.from(book)
				.where(and(eq(book.userId, userId), inArray(book.seriesId, seriesIds)))
				.orderBy(book.seriesId, desc(book.volumeNumber)),
			db
				.select({
					seriesId: seriesGenre.seriesId,
					id: genre.id,
					name: genre.name
				})
				.from(seriesGenre)
				.innerJoin(genre, eq(seriesGenre.genreId, genre.id))
				.where(and(eq(genre.userId, userId), inArray(seriesGenre.seriesId, seriesIds)))
				.orderBy(asc(genre.name))
		]);
		logger.debug({ userId, seriesCount: se.length }, 'Fetched user series');

		const latestBySeriesId = new Map(latestVolumes.map((v) => [v.seriesId, v]));
		const genresBySeriesId = new Map<string, { id: string; name: string }[]>();
		for (const { seriesId, ...genreEntry } of genreRows) {
			const list = genresBySeriesId.get(seriesId);
			if (list) list.push(genreEntry);
			else genresBySeriesId.set(seriesId, [genreEntry]);
		}

		const seriesEntries = se.map((entry) => ({
			...entry,
			latestVolume: latestBySeriesId.get(entry.id),
			genres: genresBySeriesId.get(entry.id) ?? []
		}));

		return {
			seriesEntries,
			total
		};
	}
);

export const getMissingSeriesVolumes = query(
	z.object({
		seriesId: z.uuidv4()
	}),
	async (params) => {
		const { locals } = getRequestEvent();

		if (!locals.user) {
			logger.warn('Unauthorized series missing volumes fetch attempt');
			error(401, 'Unauthorized');
		}

		const volumes = await db
			.select({ volumeNumber: book.volumeNumber })
			.from(book)
			.where(and(eq(book.userId, locals.user.id), eq(book.seriesId, params.seriesId)))
			.orderBy(asc(book.volumeNumber));

		return {
			missingVolumes: findMissingVolumeNumbers(volumes.map((volume) => volume.volumeNumber))
		};
	}
);

export const getAllMissingSeriesVolumes = query(async () => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized all series missing volumes fetch attempt');
		error(401, 'Unauthorized');
	}

	const volumes = await db
		.select({
			seriesId: book.seriesId,
			coverFileId: book.coverFileId,
			seriesTitle: series.title,
			volumeNumber: book.volumeNumber
		})
		.from(book)
		.innerJoin(series, eq(series.id, book.seriesId))
		.where(eq(book.userId, locals.user.id))
		.orderBy(asc(book.seriesId), asc(book.volumeNumber));

	const volumesBySeries = new Map<
		string,
		{ seriesId: string; seriesTitle: string; latestCoverId: string; missing: number[] }
	>();
	for (const v of volumes) {
		const list = volumesBySeries.get(v.seriesId) ?? {
			seriesId: v.seriesId,
			seriesTitle: v.seriesTitle,
			latestCoverId:
				volumes
					.filter((x) => x.seriesId === v.seriesId)
					.sort((a, b) => b.volumeNumber - a.volumeNumber)
					.find((x) => x.coverFileId !== null)?.coverFileId || '',
			missing: []
		};
		if (!volumesBySeries.has(v.seriesId)) {
			volumesBySeries.set(v.seriesId, list);
		}
		list.missing.push(v.volumeNumber);
	}

	const missingBySeries = volumesBySeries
		.values()
		.toArray()
		.map((v) => {
			return { ...v, missing: findMissingVolumeNumbers(v.missing) };
		})
		.filter((v) => v.missing.length !== 0);

	return missingBySeries;
});

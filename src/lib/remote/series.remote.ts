import { command, form, getRequestEvent, query } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { and, asc, count, desc, eq, inArray, not, or, sql, SQL } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { book, series } from '#lib/server/db/schema.js';
import { isUniqueViolation } from '#lib/server/db/errors.js';
import { logger } from '#lib/server/logger.js';
import {
	CreateSeriesBatchSchema,
	CreateSeriesSchema,
	DeleteSeriesSchema,
	UpdateSeriesSchema,
	UpdateSeriesStatusSchema
} from '#lib/shared/validation/series.js';
import { z } from 'zod';
import { similarity, trgmMatch, wordSimilarity } from '#lib/server/db/trgm.js';
import { getSearchTermValue, tokenizeSearchQuery } from '#lib/shared/search.js';

/**
 * @param title - Series title.
 * @param author - Series author. A missing author is treated as empty.
 * @returns Duplicate-detection key matching `unique_user_series_title_author`.
 */
function seriesKey(title: string, author?: string | null): string {
	return `${title.trim().toLowerCase()}\u0000${(author ?? '').trim().toLowerCase()}`;
}

export const createSeries = form(CreateSeriesSchema, async (createdSeries) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized series creation attempt');
		error(401, 'Unauthorized');
	}

	let newSeriesId: string | undefined;

	try {
		newSeriesId = (
			await db
				.insert(series)
				.values({
					...createdSeries,
					userId: locals.user.id
				})
				.returning({ id: series.id })
		).at(0)?.id;
	} catch (err) {
		if (isUniqueViolation(err, 'unique_user_series_title_author')) {
			logger.warn({ userId: locals.user.id }, 'Duplicate series on create');
			invalid('A series with this title and author already exists');
		}
		throw err;
	}

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
			await tx.insert(series).values(values);
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

export const updateSeries = form(UpdateSeriesSchema, async (updatedSeries) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized series update attempt');
		error(401, 'Unauthorized');
	}

	try {
		await db
			.update(series)
			.set(updatedSeries)
			.where(and(eq(series.id, updatedSeries.id), eq(series.userId, locals.user.id)));
	} catch (err) {
		if (isUniqueViolation(err, 'unique_user_series_title_author')) {
			logger.warn(
				{ userId: locals.user.id, seriesId: updatedSeries.id },
				'Duplicate series on update'
			);
			invalid('Another series with this title and author already exists');
		}
		throw err;
	}
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

	let condition: SQL;

	switch (term.field) {
		case 'title':
			condition = titleMatch;
			break;
		case 'author':
			condition = authorMatch;
			break;
		case '':
			condition = or(titleMatch, authorMatch) ?? sql`false`;
			break;
		default:
			condition = sql`false`;
	}

	return term.negated ? not(condition) : condition;
}

function seriesSearchScore(terms: SeriesSearchTerm[]): SQL<number> {
	const positiveTerms = terms.filter((term) => !term.negated);

	if (positiveTerms.length === 0) {
		return sql<number>`0`;
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

		switch (term.field) {
			case 'title':
				return titleScore;
			case 'author':
				return authorScore;
			case '':
				return sql<number>`greatest(${titleScore}, ${authorScore})`;
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
		const selection = db.select().from(series).where(where);
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

		const latestVolumes = await db
			.selectDistinctOn([book.seriesId], {
				seriesId: book.seriesId,
				volumeNumber: book.volumeNumber,
				coverFileId: book.coverFileId
			})
			.from(book)
			.where(
				and(
					eq(book.userId, userId),
					inArray(
						book.seriesId,
						se.map((s) => s.id)
					)
				)
			)
			.orderBy(book.seriesId, desc(book.volumeNumber));
		logger.debug({ userId, seriesCount: se.length }, 'Fetched user series');

		const latestBySeriesId = new Map(latestVolumes.map((v) => [v.seriesId, v]));
		const seriesEntries = se.map((entry) => ({
			...entry,
			latestVolume: latestBySeriesId.get(entry.id)
		}));

		return {
			seriesEntries,
			total
		};
	}
);

import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error, invalid } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { series } from '$lib/server/db/schema';
import { isUniqueViolation } from '$lib/server/db/errors';
import { eq } from 'drizzle-orm';
import { CreateSeriesBatchSchema } from '$lib/validation/series';

/**
 * @param title - Series title.
 * @param author - Series author. A missing author is treated as empty.
 * @returns Duplicate-detection key matching `unique_user_series_title_author`.
 */
function seriesKey(title: string, author?: string | null): string {
	return `${title.trim().toLowerCase()}\u0000${(author ?? '').trim().toLowerCase()}`;
}

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

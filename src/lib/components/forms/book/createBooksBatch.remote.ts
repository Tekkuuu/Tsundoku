import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error, invalid } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book, series } from '$lib/server/db/schema';
import { isUniqueViolation } from '$lib/server/db/errors';
import { and, eq, inArray } from 'drizzle-orm';
import { requireOwnedFile } from '$lib/server/files';
import { CreateBooksBatchSchema, parseBoughtAtMonth } from '$lib/validation/book';

export const createBooksBatch = form(CreateBooksBatchSchema, async (data, issue) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized batch book creation attempt');
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;
	const { seriesId, books } = data;

	const ownedSeries = await db.query.series.findFirst({
		where: and(eq(series.id, seriesId), eq(series.userId, userId)),
		columns: { id: true }
	});
	if (!ownedSeries) {
		logger.warn({ userId, seriesId }, 'Batch book creation failed - series not found');
		error(404, 'Series not found');
	}

	type InvalidIssue = Parameters<typeof invalid>[number];
	const issues: InvalidIssue[] = [];
	const seen = new Set<number>();
	books.forEach((row, index) => {
		if (seen.has(row.volumeNumber)) {
			issues.push(issue.books[index].volumeNumber(`Vol. ${row.volumeNumber} is duplicated above`));
		}
		seen.add(row.volumeNumber);
	});

	const volumeNumbers = [...seen];
	const existing = await db
		.select({ volumeNumber: book.volumeNumber })
		.from(book)
		.where(
			and(
				eq(book.userId, userId),
				eq(book.seriesId, seriesId),
				inArray(book.volumeNumber, volumeNumbers)
			)
		);
	const existingVolumes = new Set(existing.map((row) => row.volumeNumber));
	books.forEach((row, index) => {
		if (existingVolumes.has(row.volumeNumber)) {
			issues.push(issue.books[index].volumeNumber(`Vol. ${row.volumeNumber} already exists`));
		}
	});

	if (issues.length > 0) {
		invalid(...issues);
	}

	const coverFileIds = [
		...new Set(books.map((row) => row.coverFileId).filter((id): id is string => Boolean(id)))
	];
	for (const coverFileId of coverFileIds) {
		await requireOwnedFile(db, coverFileId, userId, 'cover');
	}

	const values = books.map((row) => {
		const paidPrice = row.paidPrice?.trim() ? row.paidPrice.trim() : null;
		const originalPrice =
			paidPrice === null ? null : row.originalPrice?.trim() ? row.originalPrice.trim() : paidPrice;
		const isbn = row.isbn?.trim();

		return {
			userId,
			seriesId,
			volumeNumber: row.volumeNumber,
			coverFileId: row.coverFileId || null,
			isbn: isbn ? isbn : null,
			status: row.status,
			readStatus: row.readStatus,
			currencyCode: row.currencyCode?.trim() || null,
			paidPrice,
			originalPrice,
			boughtAt: parseBoughtAtMonth(row.boughtAt) ?? null
		};
	});

	try {
		await db.transaction(async (tx) => {
			await tx.insert(book).values(values);
		});
	} catch (err) {
		if (isUniqueViolation(err, 'unique_user_series_volume')) {
			logger.warn({ userId, seriesId }, 'Duplicate book volume on batch insert');
			invalid('One or more volumes already exist. Refresh the page and try again.');
		}
		throw err;
	}

	logger.info({ userId, seriesId, count: values.length }, 'Volumes created in batch');
});

import { command, form, getRequestEvent, query } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { book, orderItem, series } from '#lib/server/db/schema.js';
import { isUniqueViolation } from '#lib/server/db/errors.js';
import { logger } from '#lib/server/logger.js';
import { deleteOwnedFile, requireOwnedFile } from '#lib/server/services/files.js';
import {
	CreateBookSchema,
	CreateBooksBatchSchema,
	DeleteBookSchema,
	UpdateBookBoughtAtSchema,
	UpdateBookProgressSchema,
	UpdateBookReadStatusSchema,
	UpdateBookSchema,
	UpdateBookStatusSchema,
	isReadStatusAllowed,
	parseBoughtAtMonth,
	parseReadingDate
} from '#lib/shared/validation/book.js';

export const createBook = form(CreateBookSchema, async (data, issue) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized book creation attempt');
		error(401, 'Unauthorized');
	}

	// Empty means "never entered" (null), distinct from '0.00' (free).
	// Currency is required by validation whenever either price is set.
	// Invariant: prices are either both set or both null. Original defaults
	// to paid (no discount assumed); without paid there is no retail value
	// to attribute, so a stale original would fake "savings" in stats.
	const paidPrice = data.paidPrice?.trim() ? data.paidPrice.trim() : null;
	const originalPrice =
		paidPrice === null ? null : data.originalPrice?.trim() ? data.originalPrice.trim() : paidPrice;
	const currencyCode = data.currencyCode?.trim() || null;

	const { boughtAt, startedAt, completedAt, readCount, coverFileId, ...rest } = data;

	// A linked cover must be the caller's own staged upload (404 otherwise —
	// linking another user's file would grant read access through this book).
	let coverFile: string | null = null;
	if (coverFileId) {
		await requireOwnedFile(db, coverFileId, locals.user.id, 'cover');
		coverFile = coverFileId;
	}

	const progress = {
		startedAt: parseReadingDate(startedAt),
		completedAt: parseReadingDate(completedAt),
		readCount: readCount ?? 0
	};

	try {
		await db.insert(book).values({
			...rest,
			coverFileId: coverFile,
			userId: locals.user.id,
			paidPrice,
			originalPrice,
			currencyCode,
			boughtAt: parseBoughtAtMonth(boughtAt) ?? null,
			...progress
		});
	} catch (err) {
		if (isUniqueViolation(err, 'unique_user_series_volume')) {
			logger.warn({ userId: locals.user.id, seriesId: data.seriesId }, 'Duplicate book volume');
			invalid(issue.volumeNumber(`Vol. ${data.volumeNumber} already exists`));
		}
		throw err;
	}
});

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
			boughtAt: parseBoughtAtMonth(row.boughtAt) ?? null,
			startedAt: parseReadingDate(row.startedAt),
			completedAt: parseReadingDate(row.completedAt),
			readCount: row.readCount ?? 0
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

export const updateBook = form(UpdateBookSchema, async (data, issue) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized book update attempt');
		error(401, 'Unauthorized');
	}

	const bookInOrder = await db.query.orderItem.findFirst({
		where: and(eq(orderItem.userId, locals.user.id), eq(orderItem.bookId, data.id))
	});

	if (bookInOrder && data.status === 'Wishlist') {
		logger.warn(
			{ userId: locals.user.id, bookId: data.id },
			'Book is already present in an order and cannot be wishlisted'
		);
		invalid(issue.status('This book is part of an order and cannot be marked as Wishlist'));
	}

	const {
		id,
		boughtAt,
		startedAt,
		completedAt,
		readCount,
		paidPrice,
		originalPrice,
		currencyCode,
		coverFileId,
		...rest
	} = data;

	const currentBook = await db.query.book.findFirst({
		columns: {
			status: true,
			readStatus: true,
			paidPrice: true,
			originalPrice: true,
			coverFileId: true
		},
		where: and(eq(book.id, id), eq(book.userId, locals.user.id))
	});

	if (!currentBook) {
		logger.warn({ userId: locals.user.id, bookId: id }, 'Book not found for update');
		error(404, 'Book not found');
	}

	// '' clears the cover, a UUID links a staged upload (ownership verified),
	// undefined leaves it untouched.
	let coverFileUpdate: { coverFileId: string | null } | null = null;
	if (coverFileId !== undefined) {
		if (coverFileId === '') {
			coverFileUpdate = { coverFileId: null };
		} else {
			await requireOwnedFile(db, coverFileId, locals.user.id, 'cover');
			coverFileUpdate = { coverFileId };
		}
	}

	const finalStatus = data.status ?? currentBook.status;
	const finalReadStatus = data.readStatus ?? currentBook.readStatus;

	if (!isReadStatusAllowed(finalStatus, finalReadStatus)) {
		logger.warn(
			{ userId: locals.user.id, bookId: id, status: finalStatus, readStatus: finalReadStatus },
			'Book update would leave an inconsistent status/read status pair'
		);
		invalid(issue.readStatus('Read status must be "Not Read" unless the book is owned'));
	}

	const normalizedCurrency = currencyCode !== undefined ? currencyCode.trim() || null : undefined;

	if (normalizedCurrency !== undefined) {
		const [current] = await db
			.select({ currencyCode: book.currencyCode })
			.from(book)
			.where(and(eq(book.id, id), eq(book.userId, locals.user.id)))
			.limit(1);
		if (current && normalizedCurrency !== current.currencyCode) {
			const inOrder = await db
				.select({ id: orderItem.id })
				.from(orderItem)
				.where(and(eq(orderItem.bookId, id), eq(orderItem.userId, locals.user.id)))
				.limit(1);
			if (inOrder.length > 0) {
				logger.warn({ userId: locals.user.id, bookId: id }, 'Currency change on ordered book');
				invalid(issue.currencyCode('Currency is locked while this book is part of an order'));
			}
		}
	}

	// Keep paid/original coupled (same invariant as create): empty means
	// "never entered" (null), distinct from '0.00' (free). A null paid forces
	// a null original — otherwise a stale original on a now-priceless book
	// fakes "savings" (original - paid) in stats. A set paid with an empty
	// original refills original from paid (no discount assumed); '0.00' is
	// preserved and never treated as empty.
	let priceUpdate: { paidPrice: string | null; originalPrice: string | null } | null = null;
	if (paidPrice !== undefined || originalPrice !== undefined) {
		const submittedPaid =
			paidPrice !== undefined ? (paidPrice.trim() ? paidPrice.trim() : null) : undefined;
		const submittedOriginal =
			originalPrice !== undefined
				? originalPrice.trim()
					? originalPrice.trim()
					: null
				: undefined;

		const currentPaid = currentBook.paidPrice != null ? String(currentBook.paidPrice) : null;
		const currentOriginal =
			currentBook.originalPrice != null ? String(currentBook.originalPrice) : null;

		const effectivePaid = submittedPaid !== undefined ? submittedPaid : currentPaid;
		const effectiveOriginal = submittedOriginal !== undefined ? submittedOriginal : currentOriginal;

		if (effectivePaid === null) {
			priceUpdate = { paidPrice: null, originalPrice: null };
		} else if (effectiveOriginal === null) {
			priceUpdate = { paidPrice: effectivePaid, originalPrice: effectivePaid };
		} else {
			priceUpdate = { paidPrice: effectivePaid, originalPrice: effectiveOriginal };
		}
	}

	try {
		await db
			.update(book)
			.set({
				...rest,
				...(startedAt !== undefined ? { startedAt: parseReadingDate(startedAt) } : {}),
				...(completedAt !== undefined ? { completedAt: parseReadingDate(completedAt) } : {}),
				...(readCount !== undefined ? { readCount } : {}),
				...(boughtAt !== undefined ? { boughtAt: parseBoughtAtMonth(boughtAt) ?? null } : {}),
				...(priceUpdate !== null ? priceUpdate : {}),
				...(normalizedCurrency !== undefined ? { currencyCode: normalizedCurrency } : {}),
				...(coverFileUpdate !== null ? coverFileUpdate : {})
			})
			.where(and(eq(book.id, id), eq(book.userId, locals.user.id)));
	} catch (err) {
		if (isUniqueViolation(err, 'unique_user_series_volume')) {
			logger.warn({ userId: locals.user.id, bookId: id }, 'Duplicate book volume on update');
			invalid(
				issue.volumeNumber(
					data.volumeNumber !== undefined
						? `Vol. ${data.volumeNumber} already exists`
						: 'This volume already exists in this series'
				)
			);
		}
		throw err;
	}

	// Delete replaced/cleared bytes only after the update succeeded, so a
	// failed update can never orphan the previous cover.
	const previousCover = currentBook.coverFileId;
	const nextCover = coverFileUpdate !== null ? coverFileUpdate.coverFileId : previousCover;
	if (previousCover && previousCover !== nextCover) {
		await deleteOwnedFile(db, previousCover, locals.user.id);
	}
});

export const deleteBook = command(DeleteBookSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized book deletion attempt');
		error(401, 'Unauthorized');
	}

	const [current] = await db
		.select({ coverFileId: book.coverFileId })
		.from(book)
		.where(and(eq(book.id, data.id), eq(book.userId, locals.user.id)))
		.limit(1);

	await db.delete(book).where(and(eq(book.id, data.id), eq(book.userId, locals.user.id)));

	if (current?.coverFileId) {
		await deleteOwnedFile(db, current.coverFileId, locals.user.id);
	}
});

export const updateBookStatus = command(UpdateBookStatusSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized book status update attempt');
		error(401, 'Unauthorized');
	}

	const bookInOrder = await db.query.orderItem.findFirst({
		where: and(eq(orderItem.userId, locals.user.id), eq(orderItem.bookId, data.id))
	});
	const current = await db.query.book.findFirst({
		columns: { readStatus: true },
		where: and(eq(book.userId, locals.user.id), eq(book.id, data.id))
	});

	if (!current) {
		logger.warn({ userId: locals.user.id, bookId: data.id }, 'Book not found');
		error(404, 'Book not found');
	}

	if (bookInOrder && data.status === 'Wishlist') {
		logger.warn(
			{ userId: locals.user.id, bookId: data.id },
			'Book is already present in an order and cannot be wishlisted'
		);
		error(409, 'This book is part of an order and cannot be marked as Wishlist');
	}

	if (data.status !== 'Owned') {
		if (current.readStatus !== 'Not Read') {
			logger.warn(
				{ userId: locals.user.id, bookId: data.id, readStatus: current.readStatus },
				'Read progress cleared by status change away from Owned'
			);
		}
		await db
			.update(book)
			.set({
				status: data.status,
				readStatus: 'Not Read' as const,
				startedAt: null,
				completedAt: null,
				readCount: 0
			})
			.where(and(eq(book.id, data.id), eq(book.userId, locals.user.id)));
		return;
	}

	await db
		.update(book)
		.set({ status: data.status })
		.where(and(eq(book.id, data.id), eq(book.userId, locals.user.id)));
});

export const updateBoughtAt = command(UpdateBookBoughtAtSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized book bought-at update attempt');
		error(401, 'Unauthorized');
	}

	await db
		.update(book)
		.set({ boughtAt: parseBoughtAtMonth(data.boughtAt) ?? null })
		.where(and(eq(book.id, data.id), eq(book.userId, locals.user.id)));
});

export const updateBookReadStatus = command(UpdateBookReadStatusSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized book read status update attempt');
		error(401, 'Unauthorized');
	}

	const current = await db.query.book.findFirst({
		columns: { status: true },
		where: and(eq(book.id, data.id), eq(book.userId, locals.user.id))
	});

	if (!current) {
		logger.warn({ userId: locals.user.id, bookId: data.id }, 'Book not found');
		error(404, 'Book not found');
	}

	if (!isReadStatusAllowed(current.status, data.readStatus)) {
		logger.warn(
			{
				userId: locals.user.id,
				bookId: data.id,
				status: current.status,
				readStatus: data.readStatus
			},
			'Read status can only be set for owned books'
		);
		error(409, 'Read status can only be set for owned books');
	}

	await db
		.update(book)
		.set({ readStatus: data.readStatus })
		.where(and(eq(book.id, data.id), eq(book.userId, locals.user.id)));
});

/**
 * Updates just the reading progress (Started, Finished, read count) of an owned
 * book. Fired as individual fields change in the detail view, so any subset may
 * be omitted. Dates stay independent of the read status.
 */
export const updateBookProgress = command(UpdateBookProgressSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized book progress update attempt');
		error(401, 'Unauthorized');
	}

	const current = await db.query.book.findFirst({
		columns: { status: true, startedAt: true, completedAt: true, readCount: true },
		where: and(eq(book.id, data.id), eq(book.userId, locals.user.id))
	});

	if (!current) {
		logger.warn({ userId: locals.user.id, bookId: data.id }, 'Book not found');
		error(404, 'Book not found');
	}

	if (current.status !== 'Owned') {
		logger.warn({ userId: locals.user.id, bookId: data.id }, 'Progress set on unowned book');
		error(409, 'Reading progress can only be set for owned books');
	}

	const startedAt =
		data.startedAt !== undefined ? parseReadingDate(data.startedAt) : current.startedAt;
	const completedAt =
		data.completedAt !== undefined ? parseReadingDate(data.completedAt) : current.completedAt;
	const readCount = data.readCount !== undefined ? data.readCount : current.readCount;

	if (startedAt !== null && completedAt !== null && startedAt > completedAt) {
		logger.warn(
			{ userId: locals.user.id, bookId: data.id, startedAt, completedAt },
			'Finished date precedes Started date'
		);
		error(409, 'Finished reading must be on or after Started reading');
	}

	await db
		.update(book)
		.set({ startedAt, completedAt, readCount })
		.where(and(eq(book.id, data.id), eq(book.userId, locals.user.id)));
});

export const getReading = query(async () => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn("Unauthorized book's select");
		error(401, 'Unauthorized');
	}

	const books = await db
		.select()
		.from(book)
		.innerJoin(series, eq(series.id, book.seriesId))
		.where(and(eq(book.readStatus, 'Reading'), eq(book.userId, locals.user.id)));

	return books;
});

export const markOwned = command(UpdateBookStatusSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn("Unauthorized book's status update");
		error(401, 'Unauthorized');
	}

	await db
		.update(book)
		.set({ status: 'Owned' })
		.where(and(eq(book.id, data.id), eq(book.userId, locals.user.id)));
});

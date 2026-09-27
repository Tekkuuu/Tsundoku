import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error, invalid } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book, orderItem } from '$lib/server/db/schema';
import { isUniqueViolation } from '$lib/server/db/errors';
import { deleteOwnedFile, requireOwnedFile } from '$lib/server/files';
import { UpdateBookSchema, parseBoughtAtMonth, isReadStatusAllowed } from '$lib/validation/book';
import { and, eq } from 'drizzle-orm';

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

	const { id, boughtAt, paidPrice, originalPrice, currencyCode, coverFileId, ...rest } = data;

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

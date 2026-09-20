import { command, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book, orderItem } from '$lib/server/db/schema';
import { UpdateBookStatusSchema } from '$lib/validation/book';
import { and, eq } from 'drizzle-orm';

export const updateBookStatus = command(UpdateBookStatusSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized book status update attempt');
		error(401, 'Unauthorized');
	}

	const bookInOrder = await db.query.orderItem.findFirst({
		where: and(eq(orderItem.userId, locals.user.id), eq(orderItem.bookId, data.id))
	});
	const bookReadStatus = (
		await db.query.book.findFirst({
			columns: {
				readStatus: true
			},
			where: and(eq(book.userId, locals.user.id), eq(book.id, data.id))
		})
	)?.readStatus;

	if (bookInOrder && data.status === 'Wishlist') {
		logger.warn(
			{ userId: locals.user.id, bookId: data.id },
			'Book is already present in an order and cannot be wishlisted'
		);
		error(409, 'This book is part of an order and cannot be marked as Wishlist');
	}

	if (bookReadStatus && bookReadStatus !== 'Not Read' && data.status !== 'Owned') {
		logger.warn(
			{ userId: locals.user.id, bookId: data.id, readStatus: bookReadStatus },
			'Read progress cleared by status change away from Owned'
		);
	}

	await db
		.update(book)
		.set({
			status: data.status,
			...(data.status !== 'Owned' ? { readStatus: 'Not Read' as const } : {})
		})
		.where(and(eq(book.id, data.id), eq(book.userId, locals.user.id)));
});

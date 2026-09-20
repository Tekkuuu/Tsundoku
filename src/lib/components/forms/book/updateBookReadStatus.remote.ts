import { command, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { UpdateBookReadStatusSchema, isReadStatusAllowed } from '$lib/validation/book';
import { and, eq } from 'drizzle-orm';

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

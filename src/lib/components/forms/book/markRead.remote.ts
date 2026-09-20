import { command, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { UpdateBookReadStatusSchema, isReadStatusAllowed } from '$lib/validation/book';

export const markRead = command(UpdateBookReadStatusSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn("Unauthorized book's read status update");
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

	if (!isReadStatusAllowed(current.status, 'Completed')) {
		logger.warn(
			{ userId: locals.user.id, bookId: data.id, status: current.status },
			'Only owned books can be marked as read'
		);
		error(409, 'Only owned books can be marked as read');
	}

	await db
		.update(book)
		.set({ readStatus: 'Completed' })
		.where(and(eq(book.id, data.id), eq(book.userId, locals.user.id)));
});

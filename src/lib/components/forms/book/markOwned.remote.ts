import { command, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { UpdateBookStatusSchema } from '$lib/validation/book';
import { and, eq } from 'drizzle-orm';

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

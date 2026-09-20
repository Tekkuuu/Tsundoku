import { command, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { UpdateBookBoughtAtSchema, parseBoughtAtMonth } from '$lib/validation/book';
import { and, eq } from 'drizzle-orm';

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

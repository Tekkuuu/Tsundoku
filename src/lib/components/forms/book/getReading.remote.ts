import { query, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { book, series } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';

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

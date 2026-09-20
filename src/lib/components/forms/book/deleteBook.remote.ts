import { command, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { deleteOwnedFile } from '$lib/server/files';
import { DeleteBookSchema } from '$lib/validation/book';
import { and, eq } from 'drizzle-orm';

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

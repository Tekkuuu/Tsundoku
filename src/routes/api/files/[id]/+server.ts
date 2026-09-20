import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { book, order } from '$lib/server/db/schema';
import { deleteOwnedFile } from '$lib/server/files';
import { and, eq } from 'drizzle-orm';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Discard a staged upload (e.g. the user picked a file, then removed it
 * before submitting). Linked files are rejected: unlink through the
 * book/order form instead, so a cover can never be pulled mid-render.
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Unauthorized');
	if (!UUID_RE.test(params.id)) error(404, 'File not found');

	const [usedByBook] = await db
		.select({ id: book.id })
		.from(book)
		.where(and(eq(book.coverFileId, params.id), eq(book.userId, locals.user.id)))
		.limit(1);
	const [usedByOrder] = usedByBook
		? [null]
		: await db
				.select({ id: order.id })
				.from(order)
				.where(and(eq(order.receiptFileId, params.id), eq(order.userId, locals.user.id)))
				.limit(1);
	if (usedByBook || usedByOrder) {
		return json({ message: 'File is in use and cannot be discarded' }, { status: 409 });
	}

	const deleted = await deleteOwnedFile(db, params.id, locals.user.id);
	if (!deleted) error(404, 'File not found');
	return json({ ok: true });
};

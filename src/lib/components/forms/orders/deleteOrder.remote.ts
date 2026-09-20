import { command, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { order } from '$lib/server/db/schema';
import { deleteOwnedFile } from '$lib/server/files';
import { DeleteOrderSchema } from '$lib/validation/order';
import { and, eq } from 'drizzle-orm';

export const deleteOrder = command(DeleteOrderSchema, async ({ id }) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order deletion attempt');
		error(401, 'Unauthorized');
	}

	const [current] = await db
		.select({ receiptFileId: order.receiptFileId })
		.from(order)
		.where(and(eq(order.id, id), eq(order.userId, locals.user.id)))
		.limit(1);

	await db.delete(order).where(and(eq(order.id, id), eq(order.userId, locals.user.id)));

	if (current?.receiptFileId) {
		await deleteOwnedFile(db, current.receiptFileId, locals.user.id);
	}
});

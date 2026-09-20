import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { order } from '$lib/server/db/schema';
import { requireOwnedFile } from '$lib/server/files';
import { CreateOrderSchema } from '$lib/validation/order';

export const createOrder = form(CreateOrderSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order creation attempt');
		error(401, 'Unauthorized');
	}

	const { orderDate, receiptFileId, ...rest } = data;
	// Currency is required by validation: the user must provide it.
	const currencyCode = data.currencyCode.trim();

	// A linked receipt must be the caller's own staged upload (404 otherwise —
	// linking another user's file would grant read access through this order).
	let receiptFile: string | null = null;
	if (receiptFileId) {
		await requireOwnedFile(db, receiptFileId, locals.user.id, 'receipt');
		receiptFile = receiptFileId;
	}

	const [newOrder] = await db
		.insert(order)
		.values({
			...rest,
			receiptFileId: receiptFile,
			userId: locals.user.id,
			currencyCode,
			orderDate: orderDate ? new Date(orderDate) : undefined
		})
		.returning({ id: order.id });

	logger.info({ userId: locals.user.id, orderId: newOrder.id }, 'Order created');

	redirect(303, `/orders/${newOrder.id}`);
});

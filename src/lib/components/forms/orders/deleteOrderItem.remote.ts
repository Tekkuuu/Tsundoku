import { command, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { order, orderItem } from '$lib/server/db/schema';
import { DeleteOrderItemSchema } from '$lib/validation/order';
import { and, eq } from 'drizzle-orm';

export const deleteOrderItem = command(DeleteOrderItemSchema, async ({ id }) => {
	const { locals, params } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order item deletion attempt');
		error(401, 'Unauthorized');
	}

	const orderId = params.orderId;
	if (!orderId) {
		logger.warn('Delete order item failed - no order ID in route');
		error(400, 'Order ID is required');
	}

	const existingOrder = await db.query.order.findFirst({
		where: and(eq(order.id, orderId), eq(order.userId, locals.user.id))
	});

	if (!existingOrder) {
		logger.warn({ userId: locals.user.id, orderId }, 'Delete order item failed - order not found');
		error(404, 'Order not found');
	}

	await db
		.delete(orderItem)
		.where(
			and(
				eq(orderItem.id, id),
				eq(orderItem.orderId, orderId),
				eq(orderItem.userId, locals.user.id)
			)
		);
});

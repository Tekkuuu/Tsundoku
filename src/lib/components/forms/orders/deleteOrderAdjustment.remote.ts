import { command, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { order, orderAdjustment } from '$lib/server/db/schema';
import { DeleteOrderAdjustmentSchema } from '$lib/validation/order';
import { and, eq } from 'drizzle-orm';

export const deleteOrderAdjustment = command(DeleteOrderAdjustmentSchema, async ({ id }) => {
	const { locals, params } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order adjustment deletion attempt');
		error(401, 'Unauthorized');
	}

	const orderId = params.orderId;
	if (!orderId) {
		logger.warn('Delete order adjustment failed - no order ID in route');
		error(400, 'Order ID is required');
	}

	const existingOrder = await db.query.order.findFirst({
		where: and(eq(order.id, orderId), eq(order.userId, locals.user.id))
	});

	if (!existingOrder) {
		logger.warn(
			{ userId: locals.user.id, orderId },
			'Delete order adjustment failed - order not found'
		);
		error(404, 'Order not found');
	}

	await db
		.delete(orderAdjustment)
		.where(
			and(
				eq(orderAdjustment.id, id),
				eq(orderAdjustment.orderId, orderId),
				eq(orderAdjustment.userId, locals.user.id)
			)
		);
});

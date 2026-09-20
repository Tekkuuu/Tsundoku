import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { order, orderAdjustment } from '$lib/server/db/schema';
import { UpdateOrderAdjustmentSchema } from '$lib/validation/order';
import { and, eq } from 'drizzle-orm';

export const updateOrderAdjustment = form(UpdateOrderAdjustmentSchema, async (data) => {
	const { locals, params } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order adjustment update attempt');
		error(401, 'Unauthorized');
	}

	const orderId = params.orderId;
	if (!orderId) {
		logger.warn('Update order adjustment failed - no order ID in route');
		error(400, 'Order ID is required');
	}

	const { id, ...rest } = data;

	const existingOrder = await db.query.order.findFirst({
		where: and(eq(order.id, orderId), eq(order.userId, locals.user.id))
	});

	if (!existingOrder) {
		logger.warn(
			{ userId: locals.user.id, orderId },
			'Update order adjustment failed - order not found'
		);
		error(404, 'Order not found');
	}

	await db
		.update(orderAdjustment)
		.set({
			name: rest.name,
			amount: rest.amount
		})
		.where(
			and(
				eq(orderAdjustment.id, id),
				eq(orderAdjustment.orderId, orderId),
				eq(orderAdjustment.userId, locals.user.id)
			)
		);
});

import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { order, orderAdjustment } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { CreateOrderAdjustmentSchema } from '$lib/validation/order';

export const createOrderAdjustment = form(CreateOrderAdjustmentSchema, async (data) => {
	const { locals, params } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order adjustment creation attempt');
		error(401, 'Unauthorized');
	}

	const orderId = params.orderId;
	if (!orderId) {
		logger.warn('Create order adjustment failed - no order ID in route');
		error(400, 'Order ID is required');
	}

	const existingOrder = await db.query.order.findFirst({
		where: and(eq(order.id, orderId), eq(order.userId, locals.user.id))
	});

	if (!existingOrder) {
		logger.warn(
			{ userId: locals.user.id, orderId },
			'Create order adjustment failed - order not found'
		);
		error(404, 'Order not found');
	}

	try {
		await db.insert(orderAdjustment).values({
			orderId,
			name: data.name,
			amount: data.amount,
			userId: locals.user.id
		});
		logger.info(
			{ userId: locals.user.id, orderId, name: data.name },
			'Order adjustment added successfully'
		);
	} catch (err) {
		logger.error(
			{
				userId: locals.user.id,
				orderId,
				error: err instanceof Error ? err.message : String(err)
			},
			'Failed to add order adjustment'
		);
		error(500, 'Failed to add order adjustment');
	}
});

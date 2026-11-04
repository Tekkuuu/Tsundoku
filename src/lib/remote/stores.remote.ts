import { getRequestEvent, query } from '$app/server';
import { db } from '#lib/server/db/index.js';
import { order } from '#lib/server/db/schema.js';
import { logger } from '#lib/server/logger.js';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

export const getUniqueStores = query(async (): Promise<string[]> => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized monthly finance stats select');
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;

	const stores = await db
		.selectDistinctOn([order.storeName], { storeName: order.storeName })
		.from(order)
		.where(eq(order.userId, userId));

	return stores.map((s) => s.storeName);
});

import { db } from '$lib/server/db';
import { series, book, order, orderItem } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const seriesInfo = (
		await db
			.select()
			.from(series)
			.where(and(eq(series.id, params.seriesId), eq(series.userId, locals.user.id)))
			.limit(1)
	)[0];

	if (!seriesInfo) {
		logger.warn(
			{ userId: locals.user.id, seriesId: params.seriesId },
			'Series not found for book update'
		);
		error(404, { message: 'Series not found' });
	}

	const bookInfo = (
		await db
			.select()
			.from(book)
			.where(
				and(
					eq(book.id, params.bookId),
					eq(book.seriesId, params.seriesId),
					eq(book.userId, locals.user.id)
				)
			)
			.limit(1)
	)[0];

	if (!bookInfo) {
		logger.warn(
			{ userId: locals.user.id, seriesId: params.seriesId, bookId: params.bookId },
			'Book not found for update'
		);
		error(404, { message: 'Book not found' });
	}

	// One book can be in at most one order: needed to lock the currency field.
	const bookOrderRows = await db
		.select({
			id: order.id,
			storeName: order.storeName,
			orderNumber: order.orderNumber,
			orderDate: order.orderDate
		})
		.from(orderItem)
		.innerJoin(order, eq(orderItem.orderId, order.id))
		.where(and(eq(orderItem.bookId, params.bookId), eq(orderItem.userId, locals.user.id)))
		.limit(1);

	return {
		seriesInfo,
		bookInfo,
		bookOrder: bookOrderRows[0] ?? null
	};
};

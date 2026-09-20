import { db } from '$lib/server/db';
import { series, book, order, orderItem } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, { message: 'Unauthorized' });
	}

	logger.debug({ userId: locals.user.id, seriesId: params.seriesId }, 'Fetching series info');
	const seriesInfo = (
		await db
			.select()
			.from(series)
			.where(and(eq(series.id, params.seriesId), eq(series.userId, locals.user.id)))
			.limit(1)
	)[0];
	const seriesBooks = await db
		.select()
		.from(book)
		.where(and(eq(book.seriesId, params.seriesId), eq(book.userId, locals.user.id)));

	logger.debug(
		{ userId: locals.user.id, seriesId: params.seriesId, bookCount: seriesBooks.length },
		'Fetched series books'
	);

	if (!seriesInfo) {
		logger.warn({ userId: locals.user.id, seriesId: params.seriesId }, 'Series not found');
		error(404, { message: 'Series not found' });
	}

	// One book can be in at most one order: map bookId -> order info so the UI
	// can warn before deleting a book that would alter a historical order total.
	const itemsInOrders = await db
		.select({
			bookId: orderItem.bookId,
			storeName: order.storeName,
			orderNumber: order.orderNumber,
			orderDate: order.orderDate
		})
		.from(orderItem)
		.innerJoin(order, eq(orderItem.orderId, order.id))
		.innerJoin(book, eq(orderItem.bookId, book.id))
		.where(
			and(
				eq(orderItem.userId, locals.user.id),
				eq(book.seriesId, params.seriesId),
				eq(book.userId, locals.user.id)
			)
		);

	const booksInOrders: Record<
		string,
		{ storeName: string; orderNumber: string | null; orderDate: Date | null }
	> = {};
	for (const row of itemsInOrders) {
		booksInOrders[row.bookId] = {
			storeName: row.storeName,
			orderNumber: row.orderNumber,
			orderDate: row.orderDate
		};
	}

	return {
		seriesInfo,
		seriesBooks,
		booksInOrders
	};
};

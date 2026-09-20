import { db } from '$lib/server/db';
import { order, orderItem, book, series } from '$lib/server/db/schema';
import { and, asc, eq, isNotNull, notInArray } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	logger.debug({ userId: locals.user.id, orderId: params.orderId }, 'Fetching order details');

	const orderData = await db.query.order.findFirst({
		where: and(eq(order.userId, locals.user.id), eq(order.id, params.orderId)),
		with: {
			adjustments: true,
			items: {
				with: {
					book: {
						with: {
							series: {
								columns: { title: true }
							}
						}
					}
				}
			}
		}
	});

	if (!orderData) {
		logger.warn({ userId: locals.user.id, orderId: params.orderId }, 'Order not found');
		error(404, { message: 'Order not found' });
	}

	const orderedBooks = (
		await db
			.select({
				bookId: orderItem.bookId
			})
			.from(orderItem)
			.where(eq(orderItem.userId, locals.user.id))
	).map((ob) => ob.bookId);

	const books = await db
		.select({
			id: book.id,
			volumeNumber: book.volumeNumber,
			seriesId: book.seriesId,
			title: series.title
		})
		.from(book)
		.innerJoin(series, eq(book.seriesId, series.id))
		.where(
			and(
				eq(book.userId, locals.user.id),
				notInArray(book.id, orderedBooks),
				// One order means one currency: only priced books matching the
				// order's currency are eligible (gifts and foreign-priced books
				// are rejected server-side in createOrderItem).
				eq(book.currencyCode, orderData.currencyCode),
				isNotNull(book.paidPrice)
			)
		)
		.orderBy(asc(series.title), asc(book.volumeNumber));

	return { order: orderData, books };
};

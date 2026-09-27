import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { book, order, orderItem, series } from '$lib/server/db/schema';
import { eq, count, and } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const userId = locals.user.id;

	const ordered = await db
		.select()
		.from(book)
		.innerJoin(series, eq(series.id, book.seriesId))
		.where(and(eq(book.status, 'Ordered'), eq(book.userId, userId)));

	const orderedInOrder = await db
		.select({ bookId: orderItem.bookId })
		.from(orderItem)
		.innerJoin(book, eq(book.id, orderItem.bookId))
		.where(and(eq(orderItem.userId, userId), eq(book.status, 'Ordered')));

	const orderedMarked = ordered.map((o) => {
		return {
			...o,
			inOrder: orderedInOrder.findIndex((oio) => oio.bookId === o.book.id) == -1 ? false : true
		};
	});

	const unread = await db
		.select()
		.from(book)
		.innerJoin(series, eq(series.id, book.seriesId))
		.where(and(eq(book.status, 'Owned'), eq(book.readStatus, 'Not Read'), eq(book.userId, userId)));

	const totalVolumesOwned = (
		await db
			.select({ total: count() })
			.from(book)
			.where(and(eq(book.userId, userId), eq(book.status, 'Owned')))
	).at(0)?.total;

	const totalVolumesRead = (
		await db
			.select({ total: count() })
			.from(book)
			.where(
				and(eq(book.readStatus, 'Completed'), eq(book.userId, userId), eq(book.status, 'Owned'))
			)
	).at(0)?.total;

	const totalVolumesWishlisted = (
		await db
			.select({ total: count() })
			.from(book)
			.where(and(eq(book.status, 'Wishlist'), eq(book.userId, userId)))
	).at(0)?.total;

	const totalVolumesOrdered = (
		await db
			.select({ total: count() })
			.from(book)
			.where(and(eq(book.status, 'Ordered'), eq(book.userId, userId)))
	).at(0)?.total;

	const totalSeriesCount = (
		await db.select({ total: count() }).from(series).where(eq(series.userId, userId))
	).at(0)?.total;

	const totalOrders = (
		await db.select({ total: count() }).from(order).where(eq(order.userId, userId))
	).at(0)?.total;

	return {
		ordered: orderedMarked,
		unread,
		kpi: {
			series: {
				count: totalSeriesCount
			},
			volumes: {
				countOwned: totalVolumesOwned,
				countRead: totalVolumesRead,
				countOrdered: totalVolumesOrdered,
				countWishlisted: totalVolumesWishlisted
			},
			orders: {
				count: totalOrders
			}
		}
	};
};

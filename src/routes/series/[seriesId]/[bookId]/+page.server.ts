import { db } from '$lib/server/db';
import { series, book, order, orderItem } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	logger.debug(
		{ userId: locals.user.id, seriesId: params.seriesId, bookId: params.bookId },
		'Fetching book info'
	);

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
			'Series not found or access denied'
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
			'Book not found or access denied'
		);
		error(404, { message: 'Book not found' });
	}

	const seriesBooks = await db
		.select()
		.from(book)
		.where(and(eq(book.seriesId, params.seriesId), eq(book.userId, locals.user.id)))
		.orderBy(asc(book.volumeNumber));

	const currentIndex = seriesBooks.findIndex((b) => b.id === bookInfo.id);
	const prevBook = currentIndex > 0 ? seriesBooks[currentIndex - 1] : null;
	const nextBook = currentIndex < seriesBooks.length - 1 ? seriesBooks[currentIndex + 1] : null;

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

	logger.debug(
		{
			userId: locals.user.id,
			seriesId: params.seriesId,
			bookId: params.bookId,
			currentIndex
		},
		'Fetched book info'
	);

	return {
		seriesInfo,
		bookInfo,
		prevBookId: prevBook?.id ?? null,
		nextBookId: nextBook?.id ?? null,
		bookOrder: bookOrderRows[0] ?? null
	};
};

import { query, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { book, order, orderAdjustment, orderItem } from '$lib/server/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { buildMonthlySpend, type MonthlySpend } from './monthlySpendLogic';

export type {
	MonthlyBucket,
	UnknownSpend,
	CurrencyMonthlySpend,
	MonthlySpend
} from './monthlySpendLogic';

export const getMonthlySpend = query(async (): Promise<MonthlySpend> => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized monthly finance stats select');
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;

	const itemRows = await db
		.select({
			orderId: order.id,
			orderDate: order.orderDate,
			currency: book.currencyCode,
			paid: book.paidPrice
		})
		.from(orderItem)
		.innerJoin(order, eq(order.id, orderItem.orderId))
		.innerJoin(book, eq(book.id, orderItem.bookId))
		.where(eq(order.userId, userId));

	const adjustmentRows = await db
		.select({
			orderId: order.id,
			orderDate: order.orderDate,
			currency: order.currencyCode,
			amount: orderAdjustment.amount
		})
		.from(orderAdjustment)
		.innerJoin(order, eq(order.id, orderAdjustment.orderId))
		.where(eq(order.userId, userId));

	const manualRows = await db
		.select({
			currency: book.currencyCode,
			paid: book.paidPrice,
			boughtAt: book.boughtAt
		})
		.from(book)
		.leftJoin(orderItem, eq(orderItem.bookId, book.id))
		.where(
			and(eq(book.userId, userId), inArray(book.status, ['Ordered', 'Owned']), isNull(orderItem.id))
		);

	return buildMonthlySpend(itemRows, adjustmentRows, manualRows);
});

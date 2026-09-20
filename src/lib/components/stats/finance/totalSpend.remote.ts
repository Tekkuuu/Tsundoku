import { query, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { book, order, orderAdjustment } from '$lib/server/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';

export type AdjustmentEntry = {
	id: string;
	storeName: string | null;
	orderDate: Date | null;
	amount: number;
};

export type AdjustmentCategory = {
	name: string;
	count: number;
	// Signed sum of all amounts in the category.
	total: number;
	// total / count.
	avg: number;
	entries: AdjustmentEntry[];
};

export type CurrencySpend = {
	currency: string;
	// Money actually paid for owned/ordered books.
	totalPaid: number;
	// Retail value of the same set of books.
	totalOriginal: number;
	totalFees: number;
	totalDiscounts: number;
	// Book cost plus order adjustments.
	totalSpent: number;
	// Positive-amount adjustments, grouped by name.
	fees: AdjustmentCategory[];
	// Negative-amount adjustments, grouped by name.
	discounts: AdjustmentCategory[];
};

export type TotalSpend = {
	currencies: CurrencySpend[];
};

type RawAdjustment = {
	name: string;
	amount: number;
	id: string;
	storeName: string | null;
	orderDate: Date | null;
};

type CurrencyAccumulator = {
	currency: string;
	totalPaid: number;
	totalOriginal: number;
	fees: RawAdjustment[];
	discounts: RawAdjustment[];
};

function groupAdjustments(rows: RawAdjustment[]): AdjustmentCategory[] {
	const byName = new Map<string, AdjustmentCategory>();
	for (const row of rows) {
		const name = row.name.trim().toLocaleLowerCase();
		let category = byName.get(name);
		if (!category) {
			category = { name, count: 0, total: 0, avg: 0, entries: [] };
			byName.set(name, category);
		}
		category.count += 1;
		category.total += row.amount;
		category.entries.push({
			id: row.id,
			storeName: row.storeName,
			orderDate: row.orderDate,
			amount: row.amount
		});
	}
	for (const category of byName.values()) {
		category.avg = category.total / category.count;
		category.entries.sort((a, b) => (b.orderDate?.getTime() ?? 0) - (a.orderDate?.getTime() ?? 0));
	}
	return [...byName.values()].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
}

function sumAdjustments(rows: RawAdjustment[]): number {
	return rows.reduce((sum, adjustment) => sum + adjustment.amount, 0);
}

export const getTotalSpend = query(async (): Promise<TotalSpend> => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized finance stats select');
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;

	// Money/retail sums from books actually paid for (owned or ordered).
	const bookRows = await db
		.select({
			currency: book.currencyCode,
			paid: sql<number>`cast(coalesce(sum(${book.paidPrice}), 0) as float)`,
			original: sql<number>`cast(coalesce(sum(${book.originalPrice}), 0) as float)`
		})
		.from(book)
		.where(and(eq(book.userId, userId), inArray(book.status, ['Owned', 'Ordered'])))
		.groupBy(book.currencyCode);

	const adjustmentRows = await db
		.select({
			currency: order.currencyCode,
			name: orderAdjustment.name,
			amount: sql<number>`cast(${orderAdjustment.amount} as float)`,
			storeName: order.storeName,
			orderDate: order.orderDate,
			adjustmentId: orderAdjustment.id
		})
		.from(orderAdjustment)
		.innerJoin(order, eq(order.id, orderAdjustment.orderId))
		.where(eq(order.userId, userId));

	const map = new Map<string, CurrencyAccumulator>();

	for (const row of bookRows) {
		// Priceless books contribute nothing to money totals and have no currency
		// to attribute — skipping is numerically identical to the coalesced zeros.
		if (!row.currency) continue;
		map.set(row.currency, {
			currency: row.currency,
			totalPaid: row.paid,
			totalOriginal: row.original,
			fees: [],
			discounts: []
		});
	}

	for (const row of adjustmentRows) {
		let base = map.get(row.currency);
		if (!base) {
			base = {
				currency: row.currency,
				totalPaid: 0,
				totalOriginal: 0,
				fees: [],
				discounts: []
			};
			map.set(row.currency, base);
		}
		const raw: RawAdjustment = {
			name: row.name,
			amount: row.amount,
			id: row.adjustmentId,
			storeName: row.storeName,
			orderDate: row.orderDate
		};
		if (row.amount >= 0) {
			base.fees.push(raw);
		} else {
			base.discounts.push(raw);
		}
	}

	const currencies = [...map.values()]
		.map((c) => {
			const totalFees = sumAdjustments(c.fees);
			const totalDiscounts = sumAdjustments(c.discounts);
			return {
				currency: c.currency,
				totalPaid: c.totalPaid,
				totalOriginal: c.totalOriginal,
				totalFees,
				totalDiscounts,
				totalSpent: c.totalPaid + totalFees + totalDiscounts,
				fees: groupAdjustments(c.fees),
				discounts: groupAdjustments(c.discounts)
			};
		})
		.sort((a, b) => a.currency.localeCompare(b.currency));

	return { currencies };
});

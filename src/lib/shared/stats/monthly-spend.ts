export type MonthlyBucket = {
	month: string;
	bookCost: number;
	fees: number;
	discounts: number;
	total: number;
	orderCount: number;
	bookCount: number;
};

export type UnknownSpend = {
	// Books in no order and without a bought-at date.
	bookCost: number;
	bookCount: number;
};

export type CurrencyMonthlySpend = {
	currency: string;
	buckets: MonthlyBucket[];
	unknown: UnknownSpend;
};

export type MonthlySpend = {
	currencies: CurrencyMonthlySpend[];
};

export type ItemRow = {
	orderId: string;
	orderDate: string | Date;
	currency: string | null;
	paid: string | number | null;
};

export type AdjustmentRow = {
	orderId: string;
	orderDate: string | Date;
	currency: string;
	amount: string | number;
};

export type ManualRow = {
	currency: string | null;
	paid: string | number | null;
	boughtAt: Date | null;
};

type BucketAccumulator = {
	bookCost: number;
	fees: number;
	discounts: number;
	orderIds: Set<string>;
	bookCount: number;
};

/** Month key `YYYY-MM`, or `null` for invalid dates. */
export function toMonthKey(date: Date): string | null {
	if (Number.isNaN(date.getTime())) return null;
	const year = date.getFullYear();
	const monthIndex = date.getMonth();
	return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function emptyBucket(): BucketAccumulator {
	return { bookCost: 0, fees: 0, discounts: 0, orderIds: new Set(), bookCount: 0 };
}

function toBucket(monthKey: string, acc: BucketAccumulator): MonthlyBucket {
	return {
		month: monthKey,
		bookCost: acc.bookCost,
		fees: acc.fees,
		discounts: acc.discounts,
		total: acc.bookCost + acc.fees + acc.discounts,
		orderCount: acc.orderIds.size,
		bookCount: acc.bookCount
	};
}

export function buildMonthlySpend(
	itemRows: ItemRow[],
	adjustmentRows: AdjustmentRow[],
	manualRows: ManualRow[]
): MonthlySpend {
	const byCurrency = new Map<string, Map<string, BucketAccumulator>>();

	function getBucket(currency: string, date: Date): BucketAccumulator | null {
		const key = toMonthKey(date);
		if (!key) return null;
		let months = byCurrency.get(currency);
		if (!months) {
			months = new Map();
			byCurrency.set(currency, months);
		}
		let bucket = months.get(key);
		if (!bucket) {
			bucket = emptyBucket();
			months.set(key, bucket);
		}
		return bucket;
	}

	for (const row of itemRows) {
		// Null currency can't occur here (books join orders only with a matching
		// currency) - skip rather than misattribute if it ever does.
		if (!row.currency) continue;
		const bucket = getBucket(row.currency, new Date(row.orderDate));
		if (!bucket) continue;
		bucket.bookCost += Number(row.paid);
		bucket.bookCount += 1;
		bucket.orderIds.add(row.orderId);
	}

	for (const row of adjustmentRows) {
		const bucket = getBucket(row.currency, new Date(row.orderDate));
		if (!bucket) continue;
		const amount = Number(row.amount);
		if (amount >= 0) {
			bucket.fees += amount;
		} else {
			bucket.discounts += amount;
		}
		bucket.orderIds.add(row.orderId);
	}

	const unknownByCurrency = new Map<string, UnknownSpend>();

	for (const row of manualRows) {
		// Books with no price (e.g. gifts) stay visible in the undated list but out of money stats.
		if (!row.currency) continue;
		if (row.boughtAt) {
			const bucket = getBucket(row.currency, new Date(row.boughtAt));
			if (!bucket) continue;
			bucket.bookCost += Number(row.paid);
			bucket.bookCount += 1;
		} else {
			let unknown = unknownByCurrency.get(row.currency);
			if (!unknown) {
				unknown = { bookCost: 0, bookCount: 0 };
				unknownByCurrency.set(row.currency, unknown);
			}
			unknown.bookCost += Number(row.paid);
			unknown.bookCount += 1;
		}
	}

	const allCurrencies = new Set([...byCurrency.keys(), ...unknownByCurrency.keys()]);
	const currencies: CurrencyMonthlySpend[] = [...allCurrencies]
		.map((currency): CurrencyMonthlySpend | null => {
			const months = byCurrency.get(currency) ?? new Map<string, BucketAccumulator>();
			const sortedKeys = [...months.keys()].sort();
			if (sortedKeys.length === 0) {
				const unknown = unknownByCurrency.get(currency);
				if (!unknown || unknown.bookCount === 0) return null;
				return { currency, buckets: [], unknown };
			}

			// Fill gap months between the first and last month with spend.
			const [firstYear, firstMonth] = sortedKeys[0].split('-').map(Number);
			const [lastYear, lastMonth] = sortedKeys[sortedKeys.length - 1].split('-').map(Number);
			const cursor = new Date(firstYear, firstMonth - 1, 1);
			const end = new Date(lastYear, lastMonth - 1, 1);
			const buckets: MonthlyBucket[] = [];
			while (cursor <= end) {
				const key = toMonthKey(cursor)!;
				buckets.push(toBucket(key, months.get(key) ?? emptyBucket()));
				cursor.setMonth(cursor.getMonth() + 1);
			}
			return {
				currency,
				buckets,
				unknown: unknownByCurrency.get(currency) ?? { bookCost: 0, bookCount: 0 }
			};
		})
		.filter((c): c is CurrencyMonthlySpend => c !== null)
		.sort((a, b) => a.currency.localeCompare(b.currency));

	return { currencies };
}

import { describe, expect, it } from 'vitest';
import { buildMonthlySpend, toMonthKey } from './monthlySpendLogic';

const date = (year: number, month0: number, day = 15) => new Date(year, month0, day);

const item = (
	orderId: string,
	orderDate: string | Date,
	currency: string,
	paid: string | number
) => ({
	orderId,
	orderDate,
	currency,
	paid
});

const adjustment = (
	orderId: string,
	orderDate: string | Date,
	currency: string,
	amount: string | number
) => ({
	orderId,
	orderDate,
	currency,
	amount
});

const manual = (currency: string | null, paid: string | number, boughtAt: Date | null) => ({
	currency,
	paid,
	boughtAt
});

const bucketFor = (result: ReturnType<typeof buildMonthlySpend>, currency: string, month: string) =>
	result.currencies.find((c) => c.currency === currency)?.buckets.find((b) => b.month === month);

describe('toMonthKey', () => {
	it('formats months as zero-padded YYYY-MM', () => {
		expect(toMonthKey(date(2025, 0, 7))).toBe('2025-01');
		expect(toMonthKey(date(2025, 8, 30))).toBe('2025-09');
		expect(toMonthKey(date(2025, 11, 31))).toBe('2025-12');
	});

	it('returns null for invalid dates', () => {
		expect(toMonthKey(new Date('not a date'))).toBeNull();
	});
});

describe('buildMonthlySpend', () => {
	it('returns no currencies when there is nothing to bucket', () => {
		expect(buildMonthlySpend([], [], [])).toEqual({ currencies: [] });
	});

	it('buckets ordered items by currency and month, coercing numeric strings', () => {
		const result = buildMonthlySpend(
			[
				item('o1', date(2025, 0, 5), 'EUR', '12.34'),
				item('o1', date(2025, 0, 20), 'EUR', '7.66'),
				item('o2', date(2025, 1, 3), 'EUR', 5),
				item('o3', date(2025, 0, 10), 'JPY', 1500)
			],
			[],
			[]
		);

		expect(result.currencies.map((c) => c.currency)).toEqual(['EUR', 'JPY']);
		expect(bucketFor(result, 'EUR', '2025-01')).toEqual({
			month: '2025-01',
			bookCost: 20,
			fees: 0,
			discounts: 0,
			total: 20,
			orderCount: 1,
			bookCount: 2
		});
		expect(bucketFor(result, 'EUR', '2025-02')).toEqual({
			month: '2025-02',
			bookCost: 5,
			fees: 0,
			discounts: 0,
			total: 5,
			orderCount: 1,
			bookCount: 1
		});
		expect(bucketFor(result, 'JPY', '2025-01')).toMatchObject({ bookCost: 1500, bookCount: 1 });
	});

	it('counts distinct orders in orderCount even across items and adjustments', () => {
		const result = buildMonthlySpend(
			[
				item('o1', date(2025, 2, 1), 'EUR', 10),
				item('o1', date(2025, 2, 2), 'EUR', 10),
				item('o2', date(2025, 2, 3), 'EUR', 10)
			],
			[adjustment('o1', date(2025, 2, 4), 'EUR', 2)],
			[]
		);

		expect(bucketFor(result, 'EUR', '2025-03')).toMatchObject({ orderCount: 2, bookCount: 3 });
	});

	it('splits adjustments into fees and discounts by sign and sums them into total', () => {
		const result = buildMonthlySpend(
			[item('o1', date(2025, 3, 1), 'EUR', 100)],
			[
				adjustment('o1', date(2025, 3, 1), 'EUR', '5.50'),
				adjustment('o1', date(2025, 3, 2), 'EUR', 0),
				adjustment('o1', date(2025, 3, 3), 'EUR', '-2.25'),
				adjustment('o1', date(2025, 3, 4), 'EUR', -3)
			],
			[]
		);

		expect(bucketFor(result, 'EUR', '2025-04')).toEqual({
			month: '2025-04',
			bookCost: 100,
			fees: 5.5,
			discounts: -5.25,
			total: 100.25,
			orderCount: 1,
			bookCount: 1
		});
	});

	it('buckets manual books with a bought-at month alongside ordered ones', () => {
		const result = buildMonthlySpend(
			[item('o1', date(2025, 0, 2), 'EUR', 10)],
			[],
			[manual('EUR', '30.00', date(2025, 0, 9)), manual('EUR', 4, date(2025, 4, 3))]
		);

		expect(bucketFor(result, 'EUR', '2025-01')).toMatchObject({ bookCost: 40, bookCount: 2 });
		expect(bucketFor(result, 'EUR', '2025-05')).toMatchObject({
			bookCost: 4,
			bookCount: 1,
			orderCount: 0
		});
	});

	it('collects manual books without a date as unknown spend per currency', () => {
		const result = buildMonthlySpend(
			[],
			[],
			[manual('EUR', '12.00', null), manual('EUR', 3, null), manual('USD', 20, null)]
		);

		expect(result.currencies.map((c) => c.currency)).toEqual(['EUR', 'USD']);
		const eur = result.currencies[0];
		expect(eur.buckets).toEqual([]);
		expect(eur.unknown).toEqual({ bookCost: 15, bookCount: 2 });
		expect(result.currencies[1].unknown).toEqual({ bookCost: 20, bookCount: 1 });
	});

	it('keeps unknown spend next to dated buckets for the same currency', () => {
		const result = buildMonthlySpend(
			[],
			[],
			[manual('EUR', 10, date(2025, 5, 1)), manual('EUR', 5, null)]
		);

		const eur = result.currencies[0];
		expect(eur.buckets.map((b) => b.month)).toEqual(['2025-06']);
		expect(eur.unknown).toEqual({ bookCost: 5, bookCount: 1 });
	});

	it('skips priceless books without a currency', () => {
		const result = buildMonthlySpend(
			[],
			[],
			[manual(null, 0, date(2025, 0, 1)), manual(null, 5, null)]
		);

		expect(result).toEqual({ currencies: [] });
	});

	it('skips rows with invalid dates instead of misattributing them', () => {
		const result = buildMonthlySpend(
			[item('o1', 'garbage', 'EUR', 10)],
			[adjustment('o2', 'garbage', 'EUR', 3)],
			[manual('EUR', 8, new Date('garbage')), manual('EUR', 20, date(2025, 0, 1))]
		);

		expect(result.currencies).toHaveLength(1);
		expect(result.currencies[0].buckets.map((b) => b.month)).toEqual(['2025-01']);
		expect(bucketFor(result, 'EUR', '2025-01')).toMatchObject({ bookCost: 20, bookCount: 1 });
	});

	it('fills gap months between the first and last month with spend', () => {
		const result = buildMonthlySpend(
			[item('o1', date(2025, 0, 10), 'EUR', 10), item('o2', date(2025, 2, 10), 'EUR', 30)],
			[],
			[]
		);

		const buckets = result.currencies[0].buckets;
		expect(buckets.map((b) => b.month)).toEqual(['2025-01', '2025-02', '2025-03']);
		expect(buckets[1]).toEqual({
			month: '2025-02',
			bookCost: 0,
			fees: 0,
			discounts: 0,
			total: 0,
			orderCount: 0,
			bookCount: 0
		});
	});

	it('fills gaps across a year boundary', () => {
		const result = buildMonthlySpend(
			[item('o1', date(2024, 10, 5), 'EUR', 10), item('o2', date(2025, 0, 5), 'EUR', 10)],
			[],
			[]
		);

		expect(result.currencies[0].buckets.map((b) => b.month)).toEqual([
			'2024-11',
			'2024-12',
			'2025-01'
		]);
	});

	it('sorts currencies alphabetically', () => {
		const result = buildMonthlySpend(
			[
				item('o1', date(2025, 0, 1), 'USD', 1),
				item('o2', date(2025, 0, 1), 'EUR', 1),
				item('o3', date(2025, 0, 1), 'JPY', 1)
			],
			[],
			[]
		);

		expect(result.currencies.map((c) => c.currency)).toEqual(['EUR', 'JPY', 'USD']);
	});
});

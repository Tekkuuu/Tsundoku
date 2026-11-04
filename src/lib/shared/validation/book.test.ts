import { describe, expect, it } from 'vite-plus/test';
import {
	CreateBookSchema,
	CreateBooksBatchSchema,
	UpdateBookSchema,
	isReadStartedCompletedAllowed,
	isReadStatusAllowed,
	isValidReadingDate,
	parseReadingDate
} from './book';

const seriesId = '550e8400-e29b-41d4-a716-446655440000';

const baseBook = {
	volumeNumber: 1,
	seriesId,
	status: 'Owned',
	readStatus: 'Completed'
} as const;

describe('isReadStatusAllowed', () => {
	it('allows any read status for owned volumes', () => {
		for (const readStatus of ['Not Read', 'Reading', 'Completed'] as const) {
			expect(isReadStatusAllowed('Owned', readStatus)).toBe(true);
		}
	});

	it('only allows Not Read for wishlist and ordered volumes', () => {
		for (const status of ['Wishlist', 'Ordered'] as const) {
			expect(isReadStatusAllowed(status, 'Not Read')).toBe(true);
			expect(isReadStatusAllowed(status, 'Reading')).toBe(false);
			expect(isReadStatusAllowed(status, 'Completed')).toBe(false);
		}
	});
});

describe('CreateBookSchema', () => {
	it('accepts an owned volume with read progress', () => {
		expect(CreateBookSchema.safeParse(baseBook).success).toBe(true);
	});

	it.each(['Wishlist', 'Ordered'])('rejects a %s volume with read progress', (status) => {
		const result = CreateBookSchema.safeParse({
			...baseBook,
			status,
			readStatus: 'Completed'
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.path.includes('readStatus'))).toBe(true);
		}
	});

	it('accepts a wishlist volume that is not read', () => {
		expect(
			CreateBookSchema.safeParse({ ...baseBook, status: 'Wishlist', readStatus: 'Not Read' })
				.success
		).toBe(true);
	});

	it('accepts free-form dates and count on an owned volume', () => {
		const result = CreateBookSchema.safeParse({
			...baseBook,
			startedAt: '2026-10-01',
			completedAt: '2026-10-05',
			readCount: 2
		});
		expect(result.success).toBe(true);
	});

	it('rejects a Finished date before Started', () => {
		const result = CreateBookSchema.safeParse({
			...baseBook,
			startedAt: '2026-10-06',
			completedAt: '2026-10-05'
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.path.includes('completedAt'))).toBe(true);
		}
	});
});

describe('CreateBooksBatchSchema', () => {
	const batchBook = {
		volumeNumber: 1,
		status: 'Owned',
		readStatus: 'Not Read'
	} as const;

	it('accepts a batch of valid rows', () => {
		const result = CreateBooksBatchSchema.safeParse({
			seriesId,
			books: [batchBook, { ...batchBook, volumeNumber: 2 }]
		});
		expect(result.success).toBe(true);
	});

	it('rejects an empty batch', () => {
		const result = CreateBooksBatchSchema.safeParse({ seriesId, books: [] });
		expect(result.success).toBe(false);
	});

	it('reports the read-status mismatch against the offending row', () => {
		const result = CreateBooksBatchSchema.safeParse({
			seriesId,
			books: [batchBook, { volumeNumber: 2, status: 'Wishlist', readStatus: 'Completed' }]
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			const issue = result.error.issues.find((entry) =>
				entry.path.join('.').includes('readStatus')
			);
			expect(issue).toBeDefined();
			expect(issue?.path[0]).toBe('books');
			expect(issue?.path[1]).toBe(1);
		}
	});

	it('requires a currency when a row has a price', () => {
		const result = CreateBooksBatchSchema.safeParse({
			seriesId,
			books: [{ ...batchBook, paidPrice: '12.50' }]
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.path.includes('currencyCode'))).toBe(true);
		}
	});
});

describe('UpdateBookSchema', () => {
	it('rejects a mismatched status/read status pair', () => {
		const result = UpdateBookSchema.safeParse({
			id: seriesId,
			status: 'Ordered',
			readStatus: 'Reading'
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.path.includes('readStatus'))).toBe(true);
		}
	});

	it('allows partial updates that leave the pair to the server check', () => {
		expect(UpdateBookSchema.safeParse({ id: seriesId, status: 'Wishlist' }).success).toBe(true);
		expect(UpdateBookSchema.safeParse({ id: seriesId, readStatus: 'Completed' }).success).toBe(
			true
		);
	});

	it('rejects a Finished date before Started', () => {
		const result = UpdateBookSchema.safeParse({
			id: seriesId,
			startedAt: '2026-10-06',
			completedAt: '2026-10-05'
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.path.includes('completedAt'))).toBe(true);
		}
	});
});

describe('isReadStartedCompletedAllowed', () => {
	it('allows a standalone completedAt without startedAt', () => {
		expect(isReadStartedCompletedAllowed(undefined, '2026-10-01')).toBe(true);
	});

	it('treats empty strings as missing', () => {
		expect(isReadStartedCompletedAllowed('', '')).toBe(true);
		expect(isReadStartedCompletedAllowed('2026-10-05', '')).toBe(true);
	});

	it('enforces order only when both dates are set', () => {
		expect(isReadStartedCompletedAllowed('2026-10-01', '2026-10-05')).toBe(true);
		expect(isReadStartedCompletedAllowed('2026-10-05', '2026-10-05')).toBe(true);
		expect(isReadStartedCompletedAllowed('2026-10-06', '2026-10-05')).toBe(false);
	});

	it('rejects invalid dates', () => {
		expect(isReadStartedCompletedAllowed('not-a-date', undefined)).toBe(false);
		expect(isReadStartedCompletedAllowed(undefined, '2026-13-01')).toBe(false);
	});
});

describe('isValidReadingDate / parseReadingDate', () => {
	it('rejects dates that do not exist', () => {
		expect(isValidReadingDate('2026-02-31')).toBe(false);
		expect(isValidReadingDate('2026-02-28')).toBe(true);
		expect(isValidReadingDate('2024-02-29')).toBe(true);
	});

	it('turns unset input into null and trims set input', () => {
		expect(parseReadingDate(undefined)).toBe(null);
		expect(parseReadingDate(null)).toBe(null);
		expect(parseReadingDate('')).toBe(null);
		expect(parseReadingDate('   ')).toBe(null);
		expect(parseReadingDate(' 2026-10-14 ')).toBe('2026-10-14');
	});
});

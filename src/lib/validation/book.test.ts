import { describe, expect, it } from 'vitest';
import { CreateBookSchema, UpdateBookSchema, isReadStatusAllowed } from './book';

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
});

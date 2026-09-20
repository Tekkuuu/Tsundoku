import { describe, expect, it } from 'vitest';
import { isCapReached, parseMaxUsers } from './registration';

describe('parseMaxUsers', () => {
	it('parses a valid cap', () => {
		expect(parseMaxUsers('1')).toBe(1);
		expect(parseMaxUsers('0')).toBe(0);
		expect(parseMaxUsers(' 10 ')).toBe(10);
	});

	it('treats missing or invalid values as unlimited', () => {
		expect(parseMaxUsers(undefined)).toBeNull();
		expect(parseMaxUsers('')).toBeNull();
		expect(parseMaxUsers('   ')).toBeNull();
		expect(parseMaxUsers('abc')).toBeNull();
		expect(parseMaxUsers('-1')).toBeNull();
	});
});

describe('isCapReached', () => {
	it('blocks at and above the cap', () => {
		expect(isCapReached(1, 1)).toBe(true);
		expect(isCapReached(5, 1)).toBe(true);
		expect(isCapReached(0, 0)).toBe(true);
	});

	it('allows below the cap, or when uncapped', () => {
		expect(isCapReached(0, 1)).toBe(false);
		expect(isCapReached(999, null)).toBe(false);
	});
});

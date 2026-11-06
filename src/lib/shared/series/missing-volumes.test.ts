import { describe, expect, it } from 'vite-plus/test';
import { findMissingVolumeNumbers } from './missing-volumes';

describe('findMissingVolumeNumbers', () => {
	it('returns no gaps for empty, single or contiguous volumes', () => {
		expect(findMissingVolumeNumbers([])).toEqual([]);
		expect(findMissingVolumeNumbers([1])).toEqual([]);
		expect(findMissingVolumeNumbers([1, 2, 3])).toEqual([]);
	});

	it('fills internal gaps in ascending order', () => {
		expect(findMissingVolumeNumbers([1, 4, 5, 8])).toEqual([2, 3, 6, 7]);
	});

	it('keeps numeric order across digit boundaries', () => {
		expect(findMissingVolumeNumbers([1, 12])).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
	});

	it('ignores unsorted input and duplicate volumes', () => {
		expect(findMissingVolumeNumbers([9, 1, 5, 5])).toEqual([2, 3, 4, 6, 7, 8]);
	});

	it('does not report gaps before the first volume', () => {
		expect(findMissingVolumeNumbers([5, 7])).toEqual([6]);
	});
});

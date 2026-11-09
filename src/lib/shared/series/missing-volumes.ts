/**
 * Returns the volume numbers that fall between the lowest and highest supplied
 * volume numbers. Leading gaps (before the first volume) are not reported, so a
 * collection that starts at volume 3 is not treated as missing volumes 1 and 2.
 *
 * @param volumeNumbers Volume numbers in any order. Duplicates are ignored.
 * @returns Missing volume numbers in ascending numeric order.
 */
export function findMissingVolumeNumbers(volumeNumbers: readonly number[]): number[] {
	const sorted = [...volumeNumbers].sort((a, b) => a - b);
	const missing: number[] = [];

	for (let index = 1; index < sorted.length; index++) {
		for (let volume = sorted[index - 1] + 1; volume < sorted[index]; volume++) {
			missing.push(volume);
		}
	}

	return missing;
}

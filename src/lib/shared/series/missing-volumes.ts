/**
 * Returns the volume numbers that fall between the lowest and highest supplied
 * volume numbers. Leading gaps (before the first volume) are reported.
 *
 * @param volumeNumbers Volume numbers in any order. Duplicates are ignored.
 * @returns Missing volume numbers in ascending numeric order.
 */
export function findMissingVolumeNumbers(volumeNumbers: readonly number[]): number[] {
	const sorted = [...volumeNumbers].sort((a, b) => a - b);
	const missing: number[] = [];

	if (sorted.at(0) !== undefined && sorted.at(0) !== 1) {
		for (let index = 1; index < sorted.at(0)!; index++) {
			missing.push(index);
		}
	}

	for (let index = 1; index < sorted.length; index++) {
		for (let volume = sorted[index - 1] + 1; volume < sorted[index]; volume++) {
			missing.push(volume);
		}
	}

	return missing;
}

export type ApplyTarget = 'all' | 'selected';

export function applyToRows<T>(
	rows: readonly T[],
	selected: ReadonlySet<number>,
	target: ApplyTarget,
	patch: (row: T) => T
): T[] {
	return rows.map((row, index) => {
		if (target === 'selected' && !selected.has(index)) return row;
		return patch(row);
	});
}

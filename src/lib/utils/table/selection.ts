import { SvelteSet } from 'svelte/reactivity';

export type RowSelection = {
	readonly indices: SvelteSet<number>;
	has(index: number): boolean;
	toggle(index: number): void;
	replace(indices: Iterable<number>): void;
	clear(): void;
	afterRemove(index: number): void;
	afterInsert(index: number): void;
};

export function createRowSelection(): RowSelection {
	const indices = new SvelteSet<number>();

	function replace(next: Iterable<number>) {
		indices.clear();
		for (const index of next) indices.add(index);
	}

	return {
		indices,
		has: (index) => indices.has(index),
		toggle: (index) => {
			if (indices.has(index)) indices.delete(index);
			else indices.add(index);
		},
		replace,
		clear: () => indices.clear(),
		afterRemove: (index) => {
			const next: number[] = [];
			for (const i of indices) {
				if (i === index) continue;
				next.push(i > index ? i - 1 : i);
			}
			replace(next);
		},
		afterInsert: (index) => {
			const next: number[] = [];
			for (const i of indices) next.push(i >= index ? i + 1 : i);
			replace(next);
		}
	};
}

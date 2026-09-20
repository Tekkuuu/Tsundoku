import { browser } from '$app/environment';
import { SvelteMap } from 'svelte/reactivity';

class PersistedState<T> {
	current = $state<T>(undefined as unknown as T);

	constructor(key: string, initialValue: T) {
		const json = browser ? localStorage.getItem(key) : null;
		this.current = json ? JSON.parse(json) : initialValue;

		$effect.root(() => {
			$effect(() => {
				if (browser) {
					localStorage.setItem(key, JSON.stringify(this.current));
				}
			});
		});
	}

	get value() {
		return this.current;
	}

	set value(newValue: T) {
		this.current = newValue;
	}
}

const cache = new SvelteMap<string, PersistedState<unknown>>();

export function persistedStorage<T>(key: string, initialValue: T) {
	let state = cache.get(key) as PersistedState<T> | undefined;
	if (!state) {
		state = new PersistedState<T>(key, initialValue);
		cache.set(key, state as PersistedState<unknown>);
	}
	return state;
}

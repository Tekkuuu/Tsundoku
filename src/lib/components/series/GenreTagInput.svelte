<script lang="ts">
	import { TagsInput } from '@skeletonlabs/skeleton-svelte';
	import { Undo2, X } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { toaster } from '#lib/client/toaster.js';
	import { createGenre, getGenres } from '#lib/remote/genre.remote.js';
	import type { SeriesGenre } from '#lib/shared/validation/series.js';

	/** Genre tag editor. Unresolved entries have `id: ''`. */
	type Props = {
		genres?: SeriesGenre[];
		existing?: SeriesGenre[];
		removed?: string[];
		pending?: number;
		disabled?: boolean;
		suggestions?: string[] | undefined;
	};

	let {
		genres = $bindable([]),
		existing = [],
		removed = $bindable([]),
		pending = $bindable(0),
		disabled = false,
		suggestions = undefined
	}: Props = $props();

	const genresQuery = getGenres();
	const allSuggestions = $derived(
		suggestions ?? genresQuery.current?.map((genre) => genre.name) ?? []
	);

	const tagNames = $derived(genres.map((genre) => genre.name));
	const removedSet = $derived(new Set(removed));
	const takenNames = $derived(
		new Set([
			...tagNames.map((name) => name.trim().toLowerCase()),
			...existing.map((genre) => genre.name.trim().toLowerCase())
		])
	);
	const datalistOptions = $derived(
		allSuggestions.filter((name) => !takenNames.has(name.trim().toLowerCase()))
	);

	function validate({ inputValue, value }: { inputValue: string; value: string[] }) {
		const name = inputValue.trim().toLowerCase();
		if (!name) return false;

		if (value.some((tag) => tag.trim().toLowerCase() === name)) return false;
		return !existing.some((genre) => genre.name.trim().toLowerCase() === name);
	}

	async function createMissingGenre(placeholder: SeriesGenre) {
		pending++;
		const key = placeholder.name.trim().toLowerCase();

		try {
			const created = await createGenre(placeholder.name);

			// Compare by normalized name; `$state` proxies break identity.
			const stillPending = genres.some(
				(genre) => genre.id === '' && genre.name.trim().toLowerCase() === key
			);
			if (!stillPending) return;

			genres = genres.map((genre) =>
				genre.id === '' && genre.name.trim().toLowerCase() === key ? created : genre
			);
		} catch (err) {
			console.error('[genre] create failed', err);
			genres = genres.filter(
				(genre) => !(genre.id === '' && genre.name.trim().toLowerCase() === key)
			);
			toaster.error({
				title: m.toast_title_error(),
				description: m.genre_create_error()
			});
		} finally {
			pending--;
		}
	}

	function handleValueChange({ value }: { value: string[] }) {
		const next: SeriesGenre[] = [];
		const known = new Map(genres.map((genre) => [genre.name.trim().toLowerCase(), genre]));

		for (const rawName of value) {
			const name = rawName.trim();
			if (!name) continue;

			const key = name.toLowerCase();
			if (next.some((genre) => genre.name.toLowerCase() === key)) continue;

			const existingGenre = known.get(key);
			if (existingGenre) {
				next.push(existingGenre);
				continue;
			}

			const placeholder: SeriesGenre = { id: '', name };
			next.push(placeholder);
			void createMissingGenre(placeholder);
		}

		genres = next;
	}

	function toggleRemoved(genreId: string) {
		removed = removed.includes(genreId)
			? removed.filter((id) => id !== genreId)
			: [...removed, genreId];
	}
</script>

<TagsInput
	value={tagNames}
	onValueChange={handleValueChange}
	{validate}
	{disabled}
	editable={false}
	blurBehavior="add"
	addOnPaste
>
	<TagsInput.Label>{m.form_series_cu_genres_label()}</TagsInput.Label>
	<TagsInput.Control>
		{#each existing as genre (genre.id)}
			{@const isRemoved = removedSet.has(genre.id)}
			<button
				type="button"
				class={[
					'inline-flex items-center gap-1 rounded-full px-3 py-1 text-base font-medium transition',
					isRemoved ? 'preset-filled-error-500' : 'preset-filled-primary-500'
				]}
				aria-pressed={isRemoved}
				title={isRemoved
					? m.genre_restore({ name: genre.name })
					: m.genre_remove({ name: genre.name })}
				onclick={() => toggleRemoved(genre.id)}
			>
				{genre.name}
				{#if isRemoved}
					<Undo2 class="size-4" />
				{:else}
					<X class="size-4" />
				{/if}
			</button>
		{/each}

		<TagsInput.Context>
			{#snippet children(tagsInput)}
				{#each tagsInput().value as tag, index (tag)}
					<TagsInput.Item value={tag} {index}>
						<TagsInput.ItemPreview
							class="rounded-full! preset-filled-success-500! px-3! text-base! leading-6!"
						>
							<TagsInput.ItemText>{tag}</TagsInput.ItemText>
							<TagsInput.ItemDeleteTrigger aria-label={m.genre_remove({ name: tag })}>
								<X class="size-4" />
							</TagsInput.ItemDeleteTrigger>
						</TagsInput.ItemPreview>
						<TagsInput.ItemInput />
					</TagsInput.Item>
				{/each}
			{/snippet}
		</TagsInput.Context>
		<TagsInput.Input placeholder={m.form_series_cu_genres_placeholder()} list="genre-suggestions" />
	</TagsInput.Control>
	<datalist id="genre-suggestions">
		{#each datalistOptions as name (name)}
			<option value={name}>{name}</option>
		{/each}
	</datalist>
</TagsInput>

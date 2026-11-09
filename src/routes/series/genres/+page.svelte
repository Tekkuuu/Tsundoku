<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronLeft, Pencil, Check, X, Trash2, CaseUpper } from '@lucide/svelte';
	import { deleteGenre, getGenresWithCounts, updateGenre } from '#lib/remote/genre.remote.js';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import { createRemoteActionHandler } from '#lib/client/form-handlers.js';
	import { refreshAll } from '$app/navigation';
	import { m } from '#lib/paraglide/messages.js';

	type GenreEntry = Awaited<ReturnType<typeof getGenresWithCounts>>[number];

	const genresQuery = getGenresWithCounts();
	const genres = $derived(genresQuery.current);

	let editingId = $state<string | null>(null);
	let draft = $state('');
	let deleteDialogOpen = $state(false);
	let deleteTarget = $state<GenreEntry | null>(null);

	function capitalizeWords(value: string): string {
		return value
			.split(' ')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	function startEdit(entry: GenreEntry) {
		editingId = entry.id;
		draft = entry.name;
	}

	function handleSave(id: string) {
		void createRemoteActionHandler({
			success: m.genre_admin_renamed(),
			error: m.genre_admin_rename_conflict(),
			run: () => updateGenre({ id, name: draft }),
			onSuccess: () => {
				editingId = null;
				refreshAll();
			}
		})();
	}

	function handleCapitalize(entry: GenreEntry) {
		const name = capitalizeWords(entry.name);
		if (name === entry.name) return;
		void createRemoteActionHandler({
			success: m.genre_admin_renamed(),
			error: m.genre_admin_rename_conflict(),
			run: () => updateGenre({ id: entry.id, name }),
			onSuccess: () => refreshAll()
		})();
	}

	function handleDelete(entry: GenreEntry) {
		editingId = null;
		deleteTarget = entry;
		deleteDialogOpen = true;
	}

	function runDelete(id: string) {
		void createRemoteActionHandler({
			success: m.genre_admin_deleted(),
			run: () => deleteGenre({ id }),
			onSuccess: () => refreshAll()
		})();
	}
</script>

<svelte:head>
	<title>{m.genre_admin_title()}</title>
</svelte:head>

<main class="container flex flex-col p-2">
	<div class="mb-2 flex items-center gap-2">
		<a
			href={resolve('series')}
			class="btn preset-tonal"
			aria-label={m.common_back()}
			title={m.common_back()}
		>
			<ChevronLeft class="size-4" />
		</a>
		<div class="flex w-full items-center">
			<h1 class="text-2xl font-bold">{m.genre_admin_title()}</h1>
		</div>
	</div>

	<div class="w-full">
		{#if genres}
			{#if genres.length === 0}
				<p class="py-8 text-center text-surface-500">{m.genre_admin_empty()}</p>
			{:else}
				<ul class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
					{#each genres as entry (entry.id)}
						<li class="flex flex-wrap items-center gap-2 rounded-base preset-tonal p-2">
							{#if editingId === entry.id}
								<input
									class="input min-w-32 flex-1"
									bind:value={draft}
									maxlength={100}
									aria-label={m.genre_admin_rename()}
									onkeydown={(event) => {
										if (event.key === 'Enter') handleSave(entry.id);
										else if (event.key === 'Escape') editingId = null;
									}}
								/>
								<button
									type="button"
									class="btn btn-icon preset-filled"
									aria-label={m.genre_admin_save()}
									title={m.genre_admin_save()}
									onclick={() => handleSave(entry.id)}
								>
									<Check class="size-4" />
								</button>
								<button
									type="button"
									class="btn btn-icon preset-tonal"
									aria-label={m.common_cancel()}
									title={m.common_cancel()}
									onclick={() => (editingId = null)}
								>
									<X class="size-4" />
								</button>
							{:else}
								<span class="min-w-0 flex-1 truncate font-medium">{entry.name}</span>
								{#if entry.seriesCount === 0}
									<span class="btn cursor-default preset-filled-primary-500">
										{m.genre_admin_unused()}
									</span>
								{/if}
								<span
									class="btn btn-icon cursor-default preset-tonal"
									title={m.genre_admin_col_series()}
								>
									{entry.seriesCount}
								</span>
								<button
									type="button"
									class="btn btn-icon preset-tonal"
									aria-label={m.genre_admin_capitalize()}
									title={m.genre_admin_capitalize()}
									onclick={() => handleCapitalize(entry)}
								>
									<CaseUpper class="size-4" />
								</button>
								<button
									type="button"
									class="btn btn-icon preset-filled-warning-500"
									aria-label={m.genre_admin_rename()}
									title={m.genre_admin_rename()}
									onclick={() => startEdit(entry)}
								>
									<Pencil class="size-4" />
								</button>
								<button
									type="button"
									class="btn btn-icon preset-filled-error-500"
									aria-label={m.genre_admin_delete()}
									title={m.genre_admin_delete()}
									onclick={() => handleDelete(entry)}
								>
									<Trash2 class="size-4" />
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		{:else if genresQuery.error}
			<p class="py-8 text-center text-surface-500">{m.error_description()}</p>
		{:else}
			<div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
				{#each Array.from({ length: 6 }, (_, index) => index) as slot (slot)}
					<div class="h-14 animate-pulse rounded-base bg-surface-300-700"></div>
				{/each}
			</div>
		{/if}
	</div>
</main>

<ConfirmDialog
	title={deleteTarget && deleteTarget.seriesCount > 0
		? m.genre_admin_delete_linked_title({ count: deleteTarget.seriesCount })
		: m.genre_admin_delete()}
	message={deleteTarget
		? deleteTarget.seriesCount > 0
			? m.genre_admin_delete_linked_message({
					name: deleteTarget.name,
					count: deleteTarget.seriesCount
				})
			: m.genre_admin_delete_message({ name: deleteTarget.name })
		: ''}
	bind:open={deleteDialogOpen}
	onConfirm={() => {
		if (deleteTarget) runDelete(deleteTarget.id);
		deleteTarget = null;
	}}
/>

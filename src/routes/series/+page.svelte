<script lang="ts">
	import {
		CreateSeriesDialog,
		UpdateSeriesDialog,
		deleteSeries,
		getSeriesStatusText
	} from '$lib/components/forms/series';
	import { BookPlus, Ellipsis, ListPlus, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import Fuse from 'fuse.js';
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';
	import type { DeleteSeries, UpdateSeries } from '$lib/validation/series.js';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	import { coverSrc } from '$lib/fileUrl';
	import { createRemoteActionHandler } from '$lib/utils/formUtils';
	import { goto, invalidateAll } from '$app/navigation';
	import SearchHelpPopover from '$lib/components/SearchHelpPopover.svelte';
	import { filterSearch, type SearchField } from '$lib/utils/search';

	let { data } = $props();

	// Search
	let searchQuery = $state('');

	type SeriesEntry = (typeof data.seriesEntries)[number];

	// Shared fuzzy indexes, built once per dataset instead of per series per keystroke.
	const titleFuse = $derived(
		new Fuse(data.seriesEntries, { keys: ['title'], threshold: 0.4, ignoreLocation: true })
	);
	const authorFuse = $derived(
		new Fuse(data.seriesEntries, { keys: ['author'], threshold: 0.4, ignoreLocation: true })
	);
	const seriesFuse = $derived(
		new Fuse(data.seriesEntries, {
			keys: ['title', 'author'],
			threshold: 0.4,
			ignoreLocation: true
		})
	);

	// Memoized per-search-value id sets; dropped whenever the entries change.
	let matchCache: { entries: SeriesEntry[]; ids: Map<string, Set<string>> } | null = null;

	function matchedSeriesIds(fuse: Fuse<SeriesEntry>, scope: string, value: string): Set<string> {
		if (!matchCache || matchCache.entries !== data.seriesEntries) {
			matchCache = { entries: data.seriesEntries, ids: new Map() };
		}
		const key = `${scope}\n${value}`;
		let ids = matchCache.ids.get(key);
		if (!ids) {
			ids = new Set(fuse.search(value).map((result) => result.item.id));
			matchCache.ids.set(key, ids);
		}
		return ids;
	}

	const searchFields: Record<string, SearchField<SeriesEntry>> = {
		title: {
			type: 'text',
			get: (series) => series.title,
			match: (series, value) => matchedSeriesIds(titleFuse, 'title', value).has(series.id)
		},
		author: {
			type: 'text',
			get: (series) => series.author,
			match: (series, value) => matchedSeriesIds(authorFuse, 'author', value).has(series.id)
		}
	};

	const seriesEntries = $derived(
		filterSearch(data.seriesEntries, searchQuery, searchFields, (series, value) =>
			matchedSeriesIds(seriesFuse, 'all', value).has(series.id)
		).toSorted((a, b) => a.title.localeCompare(b.title))
	);

	// Edit Dialog
	let editDialogOpen = $state(false);
	let editableSeries: UpdateSeries = $state({
		id: ''
	});

	// Delete Dialog
	let deleteDialogOpen = $state(false);
	let deletableSeries: DeleteSeries = $state({
		id: ''
	});

	const confirmDeleteSeries = createRemoteActionHandler({
		success: m.series_success_deleteseries(),
		error: m.series_error_deleteseries(),
		run: () => deleteSeries({ id: deletableSeries.id }),
		onSuccess: () => invalidateAll()
	});

	// Create Book
	function openAddBook(entry: SeriesEntry) {
		void goto(resolve(`/series/${entry.id}/books/create`));
	}

	function openEditSeries(entry: SeriesEntry) {
		editableSeries = {
			id: entry.id,
			title: entry.title,
			author: entry.author ?? undefined,
			status: entry.status
		};
		editDialogOpen = true;
	}

	function openDeleteSeries(entry: SeriesEntry) {
		deletableSeries = { id: entry.id };
		deleteDialogOpen = true;
	}

	function handleSeriesMenuSelect(entry: SeriesEntry, value: string) {
		if (value === 'add-book') openAddBook(entry);
		else if (value === 'edit') openEditSeries(entry);
		else if (value === 'delete') openDeleteSeries(entry);
	}
</script>

{#snippet listItem(series: (typeof data.seriesEntries)[number])}
	<Menu onSelect={(event) => handleSeriesMenuSelect(series, event.value)}>
		<div
			class="grid grid-cols-[4rem_1fr_auto] grid-rows-3 items-center gap-2 card p-2 hover:preset-tonal-primary"
		>
			<a href={resolve(`/series/${series.id}`)} class="col-start-1 row-span-3 hover:opacity-80">
				<BookCover
					src={series.latestVolume ? coverSrc(series.latestVolume) : null}
					alt={m.series_cover_alt({ title: series.title })}
					imgClass="aspect-2/3 h-full rounded object-cover"
					fallbackClass="aspect-2/3 h-full rounded"
				/>
			</a>
			<a
				href={resolve(`/series/${series.id}`)}
				class="text-md col-start-2 row-start-1 block truncate font-semibold hover:underline"
			>
				{series.title}
			</a>
			<p class="col-start-2 row-start-2 truncate text-sm opacity-70">{series.author}</p>
			<p class="col-start-2 row-start-3 truncate text-sm">
				{getSeriesStatusText(series.status)}{series.latestVolume?.volumeNumber
					? ` · ${m.series_entry_volume({ volumeNumber: series.latestVolume?.volumeNumber })}`
					: ''}
			</p>
			<div class="col-start-3 row-span-3 flex items-center justify-end">
				<Menu.Trigger class="btn preset-tonal btn-sm" aria-label={m.common_more_actions()}>
					<Ellipsis class="size-4" />
				</Menu.Trigger>
			</div>
		</div>
		<Portal>
			<Menu.Positioner>
				<Menu.Content
					class="z-50 flex w-48 flex-col gap-1 card border border-surface-200-800 bg-surface-50-950 p-2 shadow-xl"
				>
					<Menu.Item
						value="add-book"
						class="flex cursor-pointer items-center gap-2 rounded-base p-2 hover:preset-filled-primary-50-950"
					>
						<BookPlus class="size-4" />
						<span>{m.series_detail_addbook()}</span>
					</Menu.Item>
					<Menu.Item
						value="edit"
						class="flex cursor-pointer items-center gap-2 rounded-base p-2 hover:preset-filled-primary-50-950"
					>
						<Pencil class="size-4" />
						<span>{m.common_edit()}</span>
					</Menu.Item>
					<Menu.Item
						value="delete"
						class="flex cursor-pointer items-center gap-2 rounded-base p-2 hover:preset-filled-primary-50-950"
					>
						<Trash2 class="size-4" />
						<span>{m.common_delete()}</span>
					</Menu.Item>
				</Menu.Content>
			</Menu.Positioner>
		</Portal>
	</Menu>
{/snippet}

<main class="p-2">
	<div class="flex flex-col items-center gap-2">
		<div class="flex w-full max-w-6xl items-center gap-2">
			<CreateSeriesDialog triggerClass="btn btn-sm preset-filled flex flex-1 items-center">
				<Plus class="size-4" />
				{m.series_addnewseries()}
			</CreateSeriesDialog>

			<a
				href={resolve('/series/create/batch')}
				class="btn flex flex-1 items-center preset-tonal btn-sm"
			>
				<ListPlus class="size-4" />
				{m.series_addnewbatch()}
			</a>
		</div>

		<div class="mb-2 flex w-full max-w-6xl items-center justify-between gap-2">
			<h1 class="text-lg font-bold">{m.series_title()}</h1>
			<SearchHelpPopover
				bind:value={searchQuery}
				placeholder={m.series_search_placeholder()}
				title={m.series_search_help_title()}
				description={m.series_search_help_description()}
				fieldsTitle={m.series_search_help_fields_title()}
				fields={['title', 'author']}
				examplesTitle={m.series_search_help_examples_title()}
				examples={[
					'title:Berserk',
					'author:"Kentarō Miura"',
					'title:"Attack on Titan"',
					'-author:Kentaro'
				]}
				operators={m.series_search_help_operators()}
			/>
		</div>

		<div class="flex w-full max-w-6xl flex-col gap-1">
			{#each seriesEntries as series (series.id)}
				{@render listItem(series)}
			{/each}
		</div>
	</div>
</main>

<UpdateSeriesDialog bind:open={editDialogOpen} series={editableSeries} />
<ConfirmDialog
	title={m.series_confirmdelete_title()}
	confirmLabel={m.common_delete()}
	message={m.series_confirmdelete_message()}
	bind:open={deleteDialogOpen}
	onConfirm={confirmDeleteSeries}
/>

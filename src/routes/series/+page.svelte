<script lang="ts">
	import CreateSeriesDialog from '#lib/components/series/CreateSeriesDialog.svelte';
	import UpdateSeriesDialog from '#lib/components/series/UpdateSeriesDialog.svelte';
	import { deleteSeries, getSeries } from '#lib/remote/series.remote.js';
	import { getSeriesStatusText } from '#lib/components/series/series-labels.js';
	import {
		BookPlus,
		Ellipsis,
		LayoutGrid,
		List,
		ListPlus,
		Pencil,
		Plus,
		Trash2
	} from '@lucide/svelte';
	import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import type { DeleteSeries, UpdateSeries } from '#lib/shared/validation/series.js';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import BookCover from '#lib/components/book/BookCover.svelte';
	import { coverSrc } from '#lib/shared/file-url.js';
	import { createRemoteActionHandler } from '#lib/client/form-handlers.js';
	import { persistedStorage } from '#lib/client/persisted-storage.svelte.js';
	import { goto, refreshAll, snapshot } from '$app/navigation';
	import SearchHelpPopover from '#lib/components/ui/SearchHelpPopover.svelte';
	import ViewModeToggle from '#lib/components/ui/ViewModeToggle.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	type SeriesResult = Awaited<ReturnType<typeof getSeries>>;
	type SeriesEntry = SeriesResult['seriesEntries'][number];

	const viewMode = persistedStorage<'grid' | 'list'>('seriesEntryViewMode', 'list');

	let searchQuery = $state('');
	let appliedSearch = $state('');
	let page = $state(1);
	let perPage = $state(24);

	$effect(() => {
		const nextSearch = searchQuery;
		if (nextSearch === appliedSearch) return;

		const timeout = setTimeout(() => {
			appliedSearch = nextSearch;
			page = 1;
		}, 250);

		return () => clearTimeout(timeout);
	});

	function createSeriesQuery(targetPage: number) {
		return getSeries({
			count: perPage,
			page: targetPage,
			search: appliedSearch.trim() || undefined
		});
	}

	// Previous total kept so pagination does not jump during loading.
	let lastTotal = $state(0);
	const totalPages = $derived(Math.max(1, Math.ceil(lastTotal / perPage)));

	const pageQueries = $derived.by(() => {
		const candidates = new SvelteSet([page]);

		if (page > 1) candidates.add(page - 1);
		if (page < totalPages) candidates.add(page + 1);

		return [...candidates]
			.sort((a, b) => a - b)
			.map((candidate) => ({
				page: candidate,
				query: createSeriesQuery(candidate)
			}));
	});
	const seriesQuery = $derived(
		pageQueries.find((candidate) => candidate.page === page)?.query ?? createSeriesQuery(page)
	);
	const seriesPage = $derived(seriesQuery.current);

	$effect(() => {
		if (seriesPage) lastTotal = seriesPage.total;
	});

	// Reading `current` starts the request; the derived array keeps it cached.
	$effect(() => {
		for (const candidate of pageQueries) {
			void candidate.query.current;
		}
	});

	const total = $derived(seriesPage?.total ?? lastTotal);
	const seriesGridClass = $derived([
		'mx-auto max-w-[calc(100vw-6rem)]',
		viewMode.value === 'grid'
			? 'grid w-full grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2'
			: 'grid w-full grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3'
	]);
	const skeletonSlots = $derived(Array.from({ length: perPage }, (_, index) => index));

	// Ensure that after deleting last item from a page we move the prev page
	$effect(() => {
		if (!seriesPage) return;

		const pageCount = Math.max(1, Math.ceil(seriesPage.total / perPage));
		if (page > pageCount) page = pageCount;
	});

	let editDialogOpen = $state(false);
	let editableSeries: UpdateSeries = $state({
		id: ''
	});

	let deleteDialogOpen = $state(false);
	let deletableSeries: DeleteSeries = $state({
		id: ''
	});

	const confirmDeleteSeries = createRemoteActionHandler({
		success: m.series_success_deleteseries(),
		error: m.series_error_deleteseries(),
		run: () => deleteSeries({ id: deletableSeries.id }),
		onSuccess: () => refreshAll()
	});

	function openAddBook(entry: SeriesEntry) {
		void goto(resolve(`series/${entry.id}/books/create`));
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

	snapshot({
		capture: () => ({
			searchQuery,
			page,
			perPage
		}),
		restore: (value) => {
			searchQuery = value.searchQuery;
			page = value.page;
			perPage = value.perPage;
		}
	});
</script>

{#snippet seriesMenu(series: SeriesEntry, triggerClass = '')}
	<Menu onSelect={(event) => handleSeriesMenuSelect(series, event.value)}>
		<Menu.Trigger
			class="btn preset-tonal btn-sm {triggerClass}"
			aria-label={m.common_more_actions()}
		>
			<Ellipsis class="size-4" />
		</Menu.Trigger>
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

{#snippet listItem(series: SeriesEntry)}
	<div
		class="grid grid-cols-[2.25rem_1fr_auto] grid-rows-3 items-center gap-x-2 rounded-base preset-tonal p-2"
	>
		<a href={resolve(`series/${series.id}`)} class="col-start-1 row-span-3">
			<BookCover
				src={series.latestVolume ? coverSrc(series.latestVolume) : null}
				alt={m.series_cover_alt({ title: series.title })}
				imgClass="h-12 w-9 rounded object-cover"
				fallbackClass="h-12 w-9 rounded"
			/>
		</a>
		<a
			href={resolve(`series/${series.id}`)}
			class="col-start-2 row-start-1 block truncate text-sm font-semibold"
		>
			{series.title}
		</a>
		<p class="col-start-2 row-start-2 truncate text-sm opacity-70">
			{series.author || m.series_detail_unknown_author()}
		</p>
		<p class="col-start-2 row-start-3 truncate text-sm">
			{getSeriesStatusText(series.status)}{series.latestVolume?.volumeNumber
				? ` · ${m.series_entry_volume({ volumeNumber: series.latestVolume?.volumeNumber })}`
				: ''}
		</p>

		<div class="col-start-3 row-span-3 self-start justify-self-end">
			{@render seriesMenu(series)}
		</div>
	</div>
{/snippet}

{#snippet gridItem(series: SeriesEntry)}
	<div
		class={[
			'group relative rounded-base bg-transparent transition-all duration-200',
			'ease-[cubic-bezier(0.6,0,0.3,2)] hover:z-50 sm:hover:scale-125 sm:hover:rotate-5'
		]}
	>
		<div class="aura aura-dual aura-light scale-105" aria-hidden="true"></div>
		<a
			href={resolve(`series/${series.id}`)}
			class="relative z-10 block transition-all duration-150"
		>
			<BookCover
				src={series.latestVolume ? coverSrc(series.latestVolume) : null}
				alt={m.series_cover_alt({ title: series.title })}
				imgClass="aspect-2/3 w-full rounded object-cover shadow-md"
				fallbackClass="aspect-2/3 w-full rounded shadow-md"
			/>
			<div
				class="absolute top-0 left-0 hidden h-full w-full flex-col items-center justify-center gap-1 rounded bg-black/50 px-2 text-center text-white opacity-0 group-hover:flex group-hover:opacity-100"
			>
				<span class="line-clamp-2 text-sm font-bold">{series.title}</span>
				<span class="line-clamp-1 text-xs opacity-90">
					{series.author || m.series_detail_unknown_author()}
				</span>
				<span class="line-clamp-1 text-xs opacity-80">
					{getSeriesStatusText(series.status)}{series.latestVolume?.volumeNumber
						? ` · ${m.series_entry_volume({ volumeNumber: series.latestVolume?.volumeNumber })}`
						: ''}
				</span>
			</div>
		</a>
	</div>
{/snippet}

{#snippet skeletonItem()}
	{#if viewMode.value === 'grid'}
		<div class="aspect-2/3 w-full animate-pulse rounded bg-surface-200-800 shadow-md"></div>
	{:else}
		<div
			class="grid grid-cols-[2.25rem_1fr_auto] grid-rows-[repeat(3,1.25rem)] items-center gap-x-2 rounded-base preset-tonal p-2"
		>
			<div class="col-start-1 row-span-3 h-12 w-9 animate-pulse rounded bg-surface-300-700"></div>

			<div
				class="col-start-2 row-start-1 h-3.5 w-2/3 animate-pulse rounded bg-surface-300-700"
			></div>

			<div class="col-start-2 row-start-2 h-3 w-1/2 animate-pulse rounded bg-surface-300-700"></div>

			<div class="col-start-2 row-start-3 h-3 w-3/4 animate-pulse rounded bg-surface-300-700"></div>

			<div
				class="col-start-3 row-span-3 h-8 w-8 animate-pulse self-start justify-self-end rounded bg-surface-300-700"
			></div>
		</div>
	{/if}
{/snippet}

<main class="container flex flex-col gap-2">
	<div class="flex min-w-0 flex-1 flex-col items-center justify-end gap-2 md:flex-row">
		<CreateSeriesDialog triggerClass="btn preset-filled flex flex-1 items-center w-full md:w-fit">
			<Plus class="size-4" />
			{m.series_addnewseries()}
		</CreateSeriesDialog>

		<a
			href={resolve('series/create/batch')}
			class="btn flex w-full flex-1 items-center preset-tonal md:w-fit"
		>
			<ListPlus class="size-4" />
			{m.series_addnewbatch()}
		</a>
		<div class="flex w-full gap-2 md:w-fit">
			<div class="w-full md:max-w-sm">
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
			<ViewModeToggle
				bind:value={viewMode.value}
				viewModes={[
					{ value: 'grid', icon: LayoutGrid },
					{ value: 'list', icon: List }
				]}
			/>
		</div>
	</div>

	{#if seriesPage}
		<div class={seriesGridClass}>
			{#each seriesPage.seriesEntries as series (series.id)}
				{@render (viewMode.value === 'grid' ? gridItem : listItem)(series)}
			{/each}
		</div>

		{#if seriesPage.seriesEntries.length === 0}
			<p class="py-8 text-center text-surface-500">
				{appliedSearch ? m.series_no_results() : m.series_empty()}
			</p>
		{/if}
	{:else if seriesQuery.error}
		<p class="py-8 text-center text-surface-500">{m.error_description()}</p>
	{:else}
		<div class={seriesGridClass} aria-hidden="true">
			{#each skeletonSlots as slot (slot)}
				{@render skeletonItem()}
			{/each}
		</div>
	{/if}

	{#if total > 0 && !seriesQuery.error}
		<Pagination bind:page count={total} bind:perPage />
	{/if}
</main>

<UpdateSeriesDialog bind:open={editDialogOpen} series={editableSeries} />
<ConfirmDialog
	title={m.series_confirmdelete_title()}
	confirmLabel={m.common_delete()}
	message={m.series_confirmdelete_message()}
	bind:open={deleteDialogOpen}
	onConfirm={confirmDeleteSeries}
/>

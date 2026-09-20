<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	import { coverSrc } from '$lib/fileUrl';
	import {
		BookStatusResetDialog,
		deleteBook,
		updateBookReadStatus,
		updateBookStatus
	} from '$lib/components/forms/book';
	import {
		UpdateSeriesDialog,
		deleteSeries,
		updateSeriesStatus,
		getSeriesStatusText
	} from '$lib/components/forms/series';
	import { createRemoteActionHandler } from '$lib/utils/formUtils';
	import { getBookStatusText, getReadStatusText, needsReadReset } from '$lib/components/forms/book';
	import { m } from '$lib/paraglide/messages';
	import { persistedStorage } from '$lib/utils/persisted-storage.svelte';
	import { book as bookValidation, series } from '$lib/validation';
	import type { BookStatus, ReadStatus } from '$lib/validation/book';
	import type { UpdateSeries } from '$lib/validation';
	import {
		BadgeCheck,
		BookOpen,
		Circle,
		CircleCheck,
		Ellipsis,
		Heart,
		LayoutGrid,
		List,
		Pencil,
		Plus,
		ShoppingCart,
		Trash2
	} from '@lucide/svelte';
	import { Menu, Portal, SegmentedControl } from '@skeletonlabs/skeleton-svelte';
	import { format } from 'date-fns';
	import _ from 'lodash';

	let { data } = $props();

	const viewMode = persistedStorage<'grid' | 'list'>('seriesViewMode', 'grid');

	let modalState = $state({
		editSeries: false,
		deleteBook: false,
		deleteSeries: false
	});

	let editableSeries: UpdateSeries = $state({ id: '' });
	let deletableBookId = $state('');

	const books = $derived(_.sortBy(data.seriesBooks, 'volumeNumber'));

	const firstBook = $derived(books.at(0));

	let seriesStatusValue = $derived(data.seriesInfo.status);
	let bookStatusTarget = $state({ id: '' });
	let bookStatusValue = $state(bookValidation.bookStatusEnum.options[0]);
	let bookReadStatusTarget = $state({ id: '' });
	let bookReadStatusValue = $state(bookValidation.readStatusEnum.options[0]);
	let pendingStatusReset = $state<{ readStatus: ReadStatus; status: BookStatus } | null>(null);

	const confirmDeleteBook = createRemoteActionHandler({
		success: m.series_detail_success_deletebook(),
		error: m.series_detail_error_deletebook(),
		run: () => deleteBook({ id: deletableBookId }),
		onSuccess: () => invalidateAll()
	});

	const confirmDeleteSeries = createRemoteActionHandler({
		success: m.series_success_deleteseries(),
		error: m.series_error_deleteseries(),
		run: () => deleteSeries({ id: data.seriesInfo.id }),
		onSuccess: async () => {
			modalState.deleteSeries = false;
			await goto(resolve('/series'));
		}
	});

	const deleteBookMessage = $derived.by(() => {
		const orderInfo = data.booksInOrders[deletableBookId];
		if (!orderInfo) {
			return m.series_detail_confirmdelete_book_message_simple();
		}
		const date = orderInfo.orderDate
			? format(new Date(orderInfo.orderDate), 'yyyy-MM-dd')
			: m.series_detail_order_unknown_date();
		return m.series_detail_confirmdelete_book_message_inorder({
			storeName: orderInfo.storeName || m.series_detail_order_unknown_store(),
			orderNumber: orderInfo.orderNumber || m.series_detail_order_no_number(),
			date
		});
	});

	const confirmUpdateSeriesStatus = createRemoteActionHandler({
		success: m.series_detail_success_seriesstatus(),
		error: m.series_detail_error_seriesstatus(),
		run: () => updateSeriesStatus({ id: data.seriesInfo.id, status: seriesStatusValue }),
		onSuccess: () => invalidateAll()
	});

	const confirmUpdateBookStatus = createRemoteActionHandler({
		success: m.series_detail_success_bookstatus(),
		error: m.series_detail_error_bookstatus_wishlist(),
		run: () => updateBookStatus({ id: bookStatusTarget.id, status: bookStatusValue }),
		onSuccess: () => invalidateAll()
	});

	function requestBookStatus(book: (typeof books)[number], status: BookStatus) {
		bookStatusTarget.id = book.id;
		bookStatusValue = status;
		if (needsReadReset(status, book.readStatus)) {
			const readStatus = book.readStatus;
			setTimeout(() => {
				pendingStatusReset = { readStatus, status };
			}, 0);
			return;
		}
		confirmUpdateBookStatus();
	}

	function confirmReadReset() {
		pendingStatusReset = null;
		confirmUpdateBookStatus();
	}

	function cancelReadReset() {
		pendingStatusReset = null;
	}

	const confirmUpdateBookReadStatus = createRemoteActionHandler({
		success: m.series_detail_success_readstatus(),
		error: m.series_detail_error_readstatus(),
		run: () =>
			updateBookReadStatus({ id: bookReadStatusTarget.id, readStatus: bookReadStatusValue }),
		onSuccess: () => invalidateAll()
	});

	function openEditBook(book: (typeof books)[number]) {
		void goto(resolve(`/series/${data.seriesInfo.id}/${book.id}/update`));
	}

	function openDeleteBook(book: (typeof books)[number]) {
		deletableBookId = book.id;
		modalState.deleteBook = true;
	}

	function openEditSeries() {
		editableSeries = {
			id: data.seriesInfo.id,
			title: data.seriesInfo.title,
			author: data.seriesInfo.author ?? undefined,
			status: data.seriesInfo.status
		};
		modalState.editSeries = true;
	}

	function handleBookMenuSelect(book: (typeof books)[number], value: string) {
		if (value === 'edit') openEditBook(book);
		else if (value === 'delete') openDeleteBook(book);
	}

	function handleSeriesMenuSelect(value: string) {
		if (value === 'edit') openEditSeries();
		else if (value === 'delete') modalState.deleteSeries = true;
	}
</script>

{#snippet statusDropdowns(book: (typeof books)[number], isGrid: boolean)}
	<Menu
		onSelect={(event) => {
			console.debug('[status-reset] status menu fired:', event.value);
			requestBookStatus(book, event.value as BookStatus);
		}}
	>
		<Menu.Trigger class={isGrid ? 'btn w-full preset-tonal btn-sm' : 'btn preset-tonal btn-sm'}>
			{#if !isGrid}
				<span class="sm:hidden">
					{#if book.status === 'Wishlist'}<Heart
							class="size-4"
						/>{:else if book.status === 'Ordered'}<ShoppingCart
							class="size-4"
						/>{:else if book.status === 'Owned'}<BadgeCheck class="size-4" />{:else}<Circle
							class="size-4"
						/>{/if}
				</span>
			{/if}
			<span class={isGrid ? '' : 'hidden sm:inline'}>{getBookStatusText(book.status)}</span>
		</Menu.Trigger>
		<Portal>
			<Menu.Positioner>
				<Menu.Content
					class="z-50 mt-2 flex w-40 flex-col gap-1 rounded-base border border-surface-200-800 preset-filled-surface-50-950 p-2 shadow-xl"
				>
					{#each bookValidation.bookStatusEnum.options as status (status)}
						<Menu.Item
							value={status}
							class={[
								'cursor-pointer rounded-base p-2 hover:preset-filled-primary-50-950',
								status === book.status && 'preset-filled-primary-50-950',
								!isGrid && 'flex items-center gap-2'
							]}
						>
							{#if !isGrid}
								<span class="size-4 md:hidden">
									{#if status === 'Wishlist'}<Heart
											class="size-4"
										/>{:else if status === 'Ordered'}<ShoppingCart
											class="size-4"
										/>{:else if status === 'Owned'}<BadgeCheck class="size-4" />{:else}<Circle
											class="size-4"
										/>{/if}
								</span>
							{/if}
							<span>{getBookStatusText(status)}</span>
						</Menu.Item>
					{/each}
				</Menu.Content>
			</Menu.Positioner>
		</Portal>
	</Menu>

	<Menu
		onSelect={(event) => {
			console.debug('[status-reset] read menu fired:', event.value);
			bookReadStatusTarget.id = book.id;
			bookReadStatusValue = event.value as ReadStatus;
			confirmUpdateBookReadStatus();
		}}
	>
		<Menu.Trigger class={isGrid ? 'btn w-full preset-tonal btn-sm' : 'btn preset-tonal btn-sm'}>
			{#if !isGrid}
				<span class="sm:hidden">
					{#if book.readStatus === 'Not Read'}<Circle
							class="size-4"
						/>{:else if book.readStatus === 'Reading'}<BookOpen
							class="size-4"
						/>{:else if book.readStatus === 'Completed'}<CircleCheck class="size-4" />{:else}<Circle
							class="size-4"
						/>{/if}
				</span>
			{/if}
			<span class={isGrid ? '' : 'hidden sm:inline'}>{getReadStatusText(book.readStatus)}</span>
		</Menu.Trigger>
		<Portal>
			<Menu.Positioner>
				<Menu.Content
					class="z-50 mt-2 flex w-40 flex-col gap-1 rounded-base border border-surface-200-800 preset-filled-surface-50-950 p-2 shadow-xl"
				>
					{#each bookValidation.readStatusEnum.options as rs (rs)}
						<Menu.Item
							value={rs}
							disabled={rs !== 'Not Read' && book.status !== 'Owned'}
							class={[
								'cursor-pointer rounded-base p-2 hover:preset-filled-primary-50-950 data-disabled:pointer-events-none data-disabled:opacity-50',
								rs === book.readStatus && 'preset-filled-primary-50-950',
								!isGrid && 'flex items-center gap-2'
							]}
						>
							{#if !isGrid}
								<span class="size-4 md:hidden">
									{#if rs === 'Not Read'}<Circle
											class="size-4"
										/>{:else if rs === 'Reading'}<BookOpen
											class="size-4"
										/>{:else if rs === 'Completed'}<CircleCheck class="size-4" />{:else}<Circle
											class="size-4"
										/>{/if}
								</span>
							{/if}
							<span>{getReadStatusText(rs)}</span>
						</Menu.Item>
					{/each}
				</Menu.Content>
			</Menu.Positioner>
		</Portal>
	</Menu>
{/snippet}

{#snippet bookMenuItems(book: (typeof books)[number], triggerClass = '')}
	<Menu onSelect={(event) => handleBookMenuSelect(book, event.value)}>
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

{#snippet listItem(book: (typeof books)[number])}
	<div class="flex items-center gap-2 rounded-base preset-tonal p-2">
		<a href={resolve(`/series/${data.seriesInfo.id}/${book.id}`)} class="shrink-0 hover:opacity-80">
			<BookCover
				src={coverSrc(book)}
				alt={m.series_detail_cover_alt_volume({ volumeNumber: book.volumeNumber })}
				imgClass="h-12 w-9 rounded object-cover"
				fallbackClass="h-12 w-9 rounded"
			/>
		</a>
		<div class="min-w-0 flex-1">
			<span class="font-medium whitespace-nowrap"
				>{m.series_entry_volume({ volumeNumber: book.volumeNumber })}</span
			>
			{#if book.isbn}<span class="text-surface-500-500 hidden text-sm sm:inline"
					>{m.series_detail_isbn({ isbn: book.isbn })}</span
				>{/if}
		</div>
		<div class="flex shrink-0 items-center gap-2">
			{@render statusDropdowns(book, false)}
			{@render bookMenuItems(book)}
		</div>
	</div>
{/snippet}

{#snippet gridItem(book: (typeof books)[number])}
	<div class="flex flex-col gap-2 rounded-base preset-tonal p-2">
		<a href={resolve(`/series/${book.seriesId}/${book.id}`)} class="block">
			<BookCover
				src={coverSrc(book)}
				alt={m.series_detail_cover_alt_volume({ volumeNumber: book.volumeNumber })}
				imgClass="aspect-2/3 w-full rounded object-cover shadow-md"
				fallbackClass="aspect-2/3 w-full rounded shadow-md"
			/>
		</a>
		<span class="text-center font-medium"
			>{m.series_entry_volume({ volumeNumber: book.volumeNumber })}</span
		>
		{@render statusDropdowns(book, true)}
		<div class="flex">
			{@render bookMenuItems(book, 'w-full')}
		</div>
	</div>
{/snippet}

<main class="mx-auto max-w-6xl p-2">
	<div class="flex flex-col items-center gap-2">
		<div class="flex w-full gap-2">
			<a
				href={resolve(`/series/${data.seriesInfo.id}/books/create`)}
				class="btn flex w-full items-center preset-filled btn-sm"
			>
				<Plus class="size-4" />
				{m.series_detail_addbook()}
			</a>
		</div>

		<div
			class="grid w-full grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_3fr] sm:items-start sm:gap-6"
		>
			<BookCover
				src={firstBook ? coverSrc(firstBook) : null}
				alt={m.series_cover_alt({ title: data.seriesInfo.title })}
				imgClass="mx-auto aspect-2/3 w-auto rounded-base object-cover max-sm:aspect-square max-sm:max-h-72"
				fallbackClass="mx-auto aspect-2/3 w-full rounded-base max-sm:aspect-square max-sm:max-h-72"
			/>
			<div
				class="flex h-full w-full flex-col items-center gap-2 text-center sm:items-start sm:text-left"
			>
				<div
					class="flex w-full flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-between"
				>
					<h1 class="text-3xl font-bold">{data.seriesInfo.title}</h1>
					<Menu onSelect={(event) => handleSeriesMenuSelect(event.value)}>
						<Menu.Trigger class="btn preset-tonal btn-sm" aria-label={m.common_more_actions()}>
							<Ellipsis class="size-4" />
						</Menu.Trigger>
						<Portal>
							<Menu.Positioner>
								<Menu.Content
									class="z-50 flex w-48 flex-col gap-1 card border border-surface-200-800 bg-surface-50-950 p-2 shadow-xl"
								>
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
				</div>
				<h2 class="text-2xl font-medium text-surface-800-200">
					{data.seriesInfo.author || m.series_detail_unknown_author()}
				</h2>

				<Menu
					onSelect={(event) => {
						seriesStatusValue = event.value as typeof seriesStatusValue;
						confirmUpdateSeriesStatus();
					}}
				>
					<Menu.Trigger class="btn w-full preset-tonal sm:w-48"
						>{getSeriesStatusText(data.seriesInfo.status)}</Menu.Trigger
					>
					<Portal>
						<Menu.Positioner>
							<Menu.Content
								class="mt-2 flex w-48 flex-col gap-2 rounded-base border border-surface-200-800 preset-filled-surface-50-950 p-2 shadow-xl"
							>
								{#each series.seriesStatusEnum.options as status (status)}
									<Menu.Item
										value={status}
										class={[
											'cursor-pointer rounded-base p-2 hover:preset-filled-primary-100-900',
											status === data.seriesInfo.status && 'preset-filled-primary-100-900'
										]}
									>
										{getSeriesStatusText(status)}
									</Menu.Item>
								{/each}
							</Menu.Content>
						</Menu.Positioner>
					</Portal>
				</Menu>
			</div>
		</div>

		<hr class="hr" />

		<div class="flex w-full items-center justify-between gap-2">
			<h2 class="text-xl font-bold">{m.series_detail_volumes()}</h2>
			<SegmentedControl
				value={viewMode.value}
				onValueChange={(details) => (viewMode.value = (details.value as 'grid' | 'list') ?? 'grid')}
			>
				<SegmentedControl.Control>
					<SegmentedControl.Indicator />
					<SegmentedControl.Item
						value="grid"
						title={m.series_detail_grid_view()}
						aria-label={m.series_detail_grid_view()}
					>
						<SegmentedControl.ItemText><LayoutGrid class="size-4" /></SegmentedControl.ItemText>
						<SegmentedControl.ItemHiddenInput />
					</SegmentedControl.Item>
					<SegmentedControl.Item
						value="list"
						title={m.series_detail_list_view()}
						aria-label={m.series_detail_list_view()}
					>
						<SegmentedControl.ItemText><List class="size-4" /></SegmentedControl.ItemText>
						<SegmentedControl.ItemHiddenInput />
					</SegmentedControl.Item>
				</SegmentedControl.Control>
			</SegmentedControl>
		</div>

		<div
			class={viewMode.value === 'grid'
				? 'grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
				: 'flex w-full flex-col gap-2'}
		>
			{#each books as book (book.id)}
				{@render (viewMode.value === 'grid' ? gridItem : listItem)(book)}
			{/each}
		</div>
	</div>
</main>

<UpdateSeriesDialog bind:open={modalState.editSeries} series={editableSeries} />
<ConfirmDialog
	bind:open={modalState.deleteBook}
	title={m.series_confirmdelete_title()}
	message={deleteBookMessage}
	onConfirm={confirmDeleteBook}
/>
<ConfirmDialog
	bind:open={modalState.deleteSeries}
	title={m.series_confirmdelete_title()}
	message={m.series_confirmdelete_message()}
	onConfirm={confirmDeleteSeries}
/>
{#if pendingStatusReset}
	<BookStatusResetDialog
		pending={pendingStatusReset}
		onConfirm={confirmReadReset}
		onCancel={cancelReadReset}
	/>
{/if}

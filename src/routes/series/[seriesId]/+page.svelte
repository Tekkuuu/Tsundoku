<script lang="ts">
	import { refreshAll, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import BookCover from '#lib/components/book/BookCover.svelte';
	import { coverSrc } from '#lib/shared/file-url.js';
	import BookStatusResetDialog from '#lib/components/book/BookStatusResetDialog.svelte';
	import UpdateSeriesDialog from '#lib/components/series/UpdateSeriesDialog.svelte';
	import { deleteBook, updateBookReadStatus, updateBookStatus } from '#lib/remote/books.remote.js';
	import {
		deleteSeries,
		updateSeriesStatus,
		getMissingSeriesVolumes
	} from '#lib/remote/series.remote.js';
	import { getSeriesStatusText } from '#lib/components/series/series-labels.js';
	import { createRemoteActionHandler } from '#lib/client/form-handlers.js';
	import {
		getBookStatusText,
		getReadStatusText,
		needsReadReset
	} from '#lib/components/book/book-labels.js';
	import { m } from '#lib/paraglide/messages.js';
	import { persistedStorage } from '#lib/client/persisted-storage.svelte.js';
	import { book as bookValidation, series } from '#lib/shared/validation/index.js';
	import type { BookStatus, ReadStatus } from '#lib/shared/validation/book.js';
	import type { UpdateSeries } from '#lib/shared/validation/index.js';
	import {
		BadgeCheck,
		BookOpen,
		Circle,
		CircleCheck,
		Ellipsis,
		Heart,
		LayoutGrid,
		List,
		ListPlus,
		Pencil,
		Plus,
		ShoppingCart,
		Trash2,
		CircleExclamationPoint,
		X
	} from '@lucide/svelte';
	import { Menu, Popover, Portal } from '@skeletonlabs/skeleton-svelte';
	import { format } from 'date-fns';
	import _ from 'lodash';
	import ViewModeToggle from '#lib/components/ui/ViewModeToggle.svelte';

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
	const missingVolumesQuery = $derived(getMissingSeriesVolumes({ seriesId: data.seriesInfo.id }));

	let seriesStatusValue = $derived(data.seriesInfo.status);
	let bookStatusTarget = $state({ id: '' });
	let bookStatusValue = $state(bookValidation.bookStatusEnum.options[0]);
	let bookReadStatusTarget = $state({ id: '' });
	let bookReadStatusValue = $state(bookValidation.readStatusEnum.options[0]);
	let pendingStatusReset = $state<{
		readStatus: ReadStatus;
		status: BookStatus;
	} | null>(null);

	const confirmDeleteBook = createRemoteActionHandler({
		success: m.series_detail_success_deletebook(),
		error: m.series_detail_error_deletebook(),
		run: () => deleteBook({ id: deletableBookId }),
		onSuccess: () => refreshAll()
	});

	const confirmDeleteSeries = createRemoteActionHandler({
		success: m.series_success_deleteseries(),
		error: m.series_error_deleteseries(),
		run: () => deleteSeries({ id: data.seriesInfo.id }),
		onSuccess: async () => {
			modalState.deleteSeries = false;
			await goto(resolve('series'));
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
		onSuccess: () => refreshAll()
	});

	const confirmUpdateBookStatus = createRemoteActionHandler({
		success: m.series_detail_success_bookstatus(),
		error: m.series_detail_error_bookstatus_wishlist(),
		run: () => updateBookStatus({ id: bookStatusTarget.id, status: bookStatusValue }),
		onSuccess: () => refreshAll()
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
			updateBookReadStatus({
				id: bookReadStatusTarget.id,
				readStatus: bookReadStatusValue
			}),
		onSuccess: () => refreshAll()
	});

	function openEditBook(book: (typeof books)[number]) {
		void goto(resolve(`series/${data.seriesInfo.id}/${book.id}/update`));
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
		<a href={resolve(`series/${data.seriesInfo.id}/${book.id}`)} class="shrink-0 hover:opacity-80">
			<BookCover
				src={coverSrc(book)}
				alt={m.series_detail_cover_alt_volume({
					volumeNumber: book.volumeNumber
				})}
				imgClass="h-12 w-9 rounded object-cover"
				fallbackClass="h-12 w-9 rounded"
			/>
		</a>
		<div class="min-w-0 flex-1">
			<span class="font-medium whitespace-nowrap">
				{m.series_entry_volume({ volumeNumber: book.volumeNumber })}
			</span>
			{#if book.isbn}<span class="text-surface-500-500 hidden text-sm sm:inline">
					{m.series_detail_isbn({ isbn: book.isbn })}
				</span>{/if}
		</div>
		<div class="flex shrink-0 items-center gap-2">
			{@render statusDropdowns(book, false)}
			{@render bookMenuItems(book)}
		</div>
	</div>
{/snippet}

{#snippet gridItem(book: (typeof books)[number])}
	<div
		class={[
			'group relative rounded-base bg-transparent p-2 transition-all duration-200',
			'ease-[cubic-bezier(0.6,0,0.3,2)] hover:z-20 hover:scale-125 hover:rotate-5'
		]}
	>
		<div class="aura aura-dual aura-light" aria-hidden="true"></div>
		<a
			href={resolve(`series/${book.seriesId}/${book.id}`)}
			class="relative z-10 block transition-all duration-150"
		>
			<BookCover
				src={coverSrc(book)}
				alt={m.series_detail_cover_alt_volume({
					volumeNumber: book.volumeNumber
				})}
				imgClass="aspect-2/3 w-full rounded object-cover shadow-md"
				fallbackClass="aspect-2/3 w-full rounded shadow-md"
			/>
			<div
				class="absolute top-0 left-0 hidden h-full w-full flex-col items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:flex group-hover:opacity-100"
			>
				<span class="text-2xl font-bold">
					{m.series_entry_volume({ volumeNumber: book.volumeNumber })}
				</span>
			</div>
		</a>
	</div>
{/snippet}

<main class="container flex flex-col gap-2">
	<div class="flex w-full flex-col gap-2 md:flex-row md:items-center">
		<a
			href={resolve(`series/${data.seriesInfo.id}/books/create`)}
			class="btn flex w-full flex-1 items-center preset-filled md:w-fit"
		>
			<Plus class="size-4" />
			{m.series_detail_addbook()}
		</a>
		<a
			href={resolve(`series/${data.seriesInfo.id}/books/create/batch`)}
			class="btn flex w-full flex-1 items-center preset-tonal md:w-fit"
		>
			<ListPlus class="size-4" />
			{m.series_detail_addbooks()}
		</a>
		<div class="ml-auto flex w-fit items-center gap-2">
			<ViewModeToggle
				bind:value={viewMode.value}
				viewModes={[
					{ value: 'grid', icon: LayoutGrid },
					{ value: 'list', icon: List }
				]}
			/>
			<Menu onSelect={(event) => handleSeriesMenuSelect(event.value)}>
				<Menu.Trigger class="btn preset-tonal" aria-label={m.common_more_actions()}>
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
	</div>

	<div class="flex items-center justify-between gap-2">
		<div class="min-w-0">
			<h1 class="text-2xl font-bold wrap-break-word lg:text-3xl">
				{data.seriesInfo.title}
			</h1>
			<h2 class="text-lg font-medium text-surface-800-200 lg:text-xl">
				{data.seriesInfo.author || m.series_detail_unknown_author()}
			</h2>
		</div>
		<div class="flex items-center gap-2">
			<Menu
				onSelect={(event) => {
					seriesStatusValue = event.value as typeof seriesStatusValue;
					confirmUpdateSeriesStatus();
				}}
			>
				<Menu.Trigger class="btn shrink-0 preset-tonal">
					{getSeriesStatusText(data.seriesInfo.status)}
				</Menu.Trigger>
				<Portal>
					<Menu.Positioner>
						<Menu.Content
							class="z-50 mt-2 flex w-48 flex-col gap-2 rounded-base border border-surface-200-800 preset-filled-surface-50-950 p-2 shadow-xl"
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
			{#await missingVolumesQuery then res}
				{#if res.missingVolumes.length > 0}
					<Popover>
						<Popover.Trigger
							class="btn shrink-0 preset-filled-error-500"
							aria-label={m.series_detail_missing_volumes_trigger({
								count: res.missingVolumes.length
							})}
							title={m.series_detail_missing_volumes_trigger({
								count: res.missingVolumes.length
							})}
						>
							<CircleExclamationPoint class="size-4" />
							<span class="tabular-nums">{res.missingVolumes.length}</span>
						</Popover.Trigger>
						<Portal>
							<Popover.Positioner>
								<Popover.Content
									class="z-50 w-72 max-w-[calc(100vw-2rem)] card bg-surface-200-800 p-4 shadow-xl"
								>
									<div class="flex items-start justify-between gap-4">
										<div class="flex items-center gap-2">
											<Popover.Title class="text-base font-semibold">
												{m.series_detail_missing_volumes_title()}
											</Popover.Title>
										</div>
										<Popover.CloseTrigger
											class="-mt-1 -mr-1 btn-icon hover:preset-tonal"
											aria-label={m.common_close()}
										>
											<X class="size-4" />
										</Popover.CloseTrigger>
									</div>
									<Popover.Description class="mt-3 text-sm text-surface-600-400">
										{m.series_detail_missing_volumes_description()}
									</Popover.Description>
									<div class="mt-3 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
										{#each res.missingVolumes as volumeNumber (volumeNumber)}
											<span class="badge preset-filled-error-500 tabular-nums">
												{volumeNumber}
											</span>
										{/each}
									</div>
									<Popover.Arrow
										class="[--arrow-background:var(--color-surface-200-800)] [--arrow-size:--spacing(2)]"
									>
										<Popover.ArrowTip />
									</Popover.Arrow>
								</Popover.Content>
							</Popover.Positioner>
						</Portal>
					</Popover>
				{/if}
			{/await}
		</div>
	</div>

	<hr class="hr" />

	<div
		class={[
			viewMode.value === 'grid'
				? 'grid w-full grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2'
				: 'grid w-full grid-cols-1 gap-2 xl:grid-cols-2 2xl:grid-cols-3'
		]}
	>
		{#each books as book (book.id)}
			{@render (viewMode.value === 'grid' ? gridItem : listItem)(book)}
		{/each}
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

<script lang="ts">
	import { goto, refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import BookStatusResetDialog from '#lib/components/book/BookStatusResetDialog.svelte';
	import {
		updateBookProgress,
		updateBookReadStatus,
		updateBookStatus
	} from '#lib/remote/books.remote.js';
	import { createRemoteActionHandler } from '#lib/client/form-handlers.js';
	import { toaster } from '#lib/client/toaster.js';
	import BookCover from '#lib/components/book/BookCover.svelte';
	import DatePickerField from '#lib/components/form/DatePickerField.svelte';
	import { coverSrc } from '#lib/shared/file-url.js';
	import type { BookStatus, ReadStatus } from '#lib/shared/validation/book.js';
	import { book as bookValidation } from '#lib/shared/validation/index.js';
	import { formatBoughtAtMonth } from '#lib/shared/validation/book.js';
	import {
		BadgeCheck,
		BookOpen,
		ChevronLeft,
		ChevronRight,
		Circle,
		CircleAlert,
		CircleCheck,
		Ellipsis,
		Heart,
		Pencil,
		ShoppingCart
	} from '@lucide/svelte';
	import { Menu, Portal, Tooltip } from '@skeletonlabs/skeleton-svelte';
	import { m } from '#lib/paraglide/messages.js';
	import {
		getBookStatusText,
		getReadStatusText,
		needsReadReset
	} from '#lib/components/book/book-labels.js';
	import { getSeriesStatusText } from '#lib/components/series/series-labels.js';

	let { data } = $props();

	let bookStatusTarget = $state({ id: '' });
	let bookStatusValue = $state(bookValidation.bookStatusEnum.options[0]);

	let bookReadStatusTarget = $state({ id: '' });
	let bookReadStatusValue = $state(bookValidation.readStatusEnum.options[0]);
	let pendingStatusReset = $state<{
		readStatus: ReadStatus;
		status: BookStatus;
	} | null>(null);

	type DateField = 'startedAt' | 'completedAt';
	type DateDrafts = Partial<Record<DateField, string>>;

	/**
	 * Optimistic dates while their save is in flight, keyed by book so a draft
	 * never leaks into another book. Removing a draft falls back to the
	 * server-provided date, which is what a failed save should show.
	 */
	let dateDrafts = $state<Record<string, DateDrafts>>({});

	const drafts = $derived(dateDrafts[data.bookInfo.id] ?? {});
	const startedAt = $derived(drafts.startedAt ?? data.bookInfo.startedAt ?? '');
	const completedAt = $derived(drafts.completedAt ?? data.bookInfo.completedAt ?? '');

	function formatPrice(price: string | null, currency: string | null) {
		return price === null ? '—' : `${price}${currency ? ` ${currency}` : ''}`;
	}

	/**
	 * Formats a stored YYYY-MM-DD date for display. Parsed as local date parts so the
	 * day does not shift with the timezone.
	 */
	function formatDay(value: string | null) {
		if (!value) return '—';
		const [year, month, day] = value.split('-').map(Number);
		return new Date(year, month - 1, day).toLocaleDateString();
	}

	/**
	 * Read count is controlled by the server data and persists on change. A
	 * failed save (e.g. Finished before Started) puts the input back to its
	 * stored value and surfaces a toast.
	 */
	type ProgressPatch = {
		startedAt?: string;
		completedAt?: string;
		readCount?: number;
	};

	function onReadCountChange(input: HTMLInputElement) {
		const readCount = input.value === '' ? 0 : Math.trunc(Number(input.value));
		if (!Number.isFinite(readCount) || readCount < 0) {
			input.value = String(data.bookInfo.readCount);
			return;
		}
		void saveProgress(input, { readCount }, String(data.bookInfo.readCount));
	}

	function onDateChange(field: DateField, value: string) {
		const bookId = data.bookInfo.id;
		dateDrafts = {
			...dateDrafts,
			[bookId]: { ...dateDrafts[bookId], [field]: value }
		};
		void saveDate(bookId, field, value);
	}

	async function saveDate(bookId: string, field: DateField, value: string) {
		try {
			await updateBookProgress({ id: bookId, [field]: value });
			await refreshAll();
		} catch (err) {
			console.error('[progress] error', err);
			toaster.error({
				title: m.toast_title_error(),
				description: m.book_detail_error_progress(),
				closable: true
			});
		} finally {
			// Drop the draft so the stored date (updated on success, unchanged on
			// failure) becomes visible again. A newer change keeps its own draft.
			const bookDrafts = dateDrafts[bookId];
			if (bookDrafts && bookDrafts[field] === value) {
				const nextBookDrafts = { ...bookDrafts };
				delete nextBookDrafts[field];
				dateDrafts = { ...dateDrafts, [bookId]: nextBookDrafts };
			}
		}
	}

	async function saveProgress(input: HTMLInputElement, patch: ProgressPatch, previous: string) {
		try {
			await updateBookProgress({ id: data.bookInfo.id, ...patch });
			await refreshAll();
		} catch (err) {
			console.error('[progress] error', err);
			input.value = previous;
			toaster.error({
				title: m.toast_title_error(),
				description: m.book_detail_error_progress(),
				closable: true
			});
		}
	}

	const boughtAtMonth = $derived(formatBoughtAtMonth(data.bookInfo.boughtAt));
	const orderDateMonth = $derived(
		data.bookOrder ? formatBoughtAtMonth(data.bookOrder.orderDate) : undefined
	);
	const purchaseDateMismatch = $derived(
		Boolean(data.bookOrder && boughtAtMonth && orderDateMonth && boughtAtMonth !== orderDateMonth)
	);

	const confirmUpdateBookStatus = createRemoteActionHandler({
		success: m.book_detail_success_status(),
		error: m.series_detail_error_bookstatus_wishlist(),
		run: () => updateBookStatus({ id: bookStatusTarget.id, status: bookStatusValue }),
		onSuccess: () => refreshAll()
	});

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

	function requestBookStatus(status: BookStatus) {
		bookStatusTarget.id = data.bookInfo.id;
		bookStatusValue = status;
		if (needsReadReset(status, data.bookInfo.readStatus)) {
			console.debug('[status-reset] needs confirm, deferring dialog');
			const readStatus = data.bookInfo.readStatus;
			setTimeout(() => {
				pendingStatusReset = { readStatus, status };
			}, 0);
			return;
		}
		console.debug('[status-reset] direct update');
		confirmUpdateBookStatus();
	}

	function confirmReadReset() {
		pendingStatusReset = null;
		confirmUpdateBookStatus();
	}

	function cancelReadReset() {
		pendingStatusReset = null;
	}
</script>

<main class="container p-4">
	<div class="flex flex-col items-center gap-4">
		<div class="flex w-full max-w-4xl items-center justify-between">
			<a href={resolve(`series/${data.seriesInfo.id}`)} class="btn preset-filled">
				{m.book_detail_back()}
			</a>

			<div class="grid grid-cols-2 gap-2">
				{#if data.prevBookId}
					<a
						href={resolve(`series/${data.seriesInfo.id}/${data.prevBookId}`)}
						class="btn justify-between preset-filled-surface-100-900"
					>
						<ChevronLeft class="size-4" />
					</a>
				{:else}
					<button class="btn justify-between preset-filled-surface-100-900" disabled>
						<ChevronLeft class="size-4" />
					</button>
				{/if}
				{#if data.nextBookId}
					<a
						href={resolve(`series/${data.seriesInfo.id}/${data.nextBookId}`)}
						class="btn justify-between preset-filled-surface-100-900"
					>
						<ChevronRight class="size-4" />
					</a>
				{:else}
					<button class="btn justify-between preset-filled-surface-100-900" disabled>
						<ChevronRight class="size-4" />
					</button>
				{/if}
			</div>
		</div>

		<div class="w-full max-w-4xl card preset-filled-surface-100-900 p-6">
			<div class="flex flex-col gap-6 md:flex-row">
				<div class="mx-auto shrink-0 md:mx-0">
					<BookCover
						src={coverSrc(data.bookInfo)}
						alt={m.series_detail_cover_alt_volume({
							volumeNumber: data.bookInfo.volumeNumber
						})}
						imgClass="h-72 w-48 rounded object-cover shadow-lg"
						fallbackClass="h-72 w-48 rounded shadow-lg"
						label={m.dashboard_widget_reading_nocover()}
					/>
				</div>

				<div class="flex-1 space-y-4">
					<div class="flex items-start justify-between gap-2">
						<div class="flex flex-col">
							<h1 class="text-2xl font-bold">{data.seriesInfo.title}</h1>
							<p class="font-medium">
								{m.series_entry_volume({
									volumeNumber: data.bookInfo.volumeNumber
								})}
							</p>
						</div>
						<Menu
							onSelect={(event) => {
								if (event.value !== 'edit') return;
								void goto(resolve(`series/${data.seriesInfo.id}/${data.bookInfo.id}/update`));
							}}
						>
							<Menu.Trigger class="btn preset-tonal btn-sm" aria-label={m.common_more_actions()}>
								<Ellipsis class="size-4" />
							</Menu.Trigger>
							<Portal>
								<Menu.Positioner>
									<Menu.Content
										class="z-50 flex w-fit flex-col gap-1 card border border-surface-200-800 bg-surface-50-950 p-2 shadow-xl"
									>
										<Menu.Item
											value="edit"
											class="flex cursor-pointer items-center gap-2 rounded-base p-2 hover:preset-filled-primary-50-950"
										>
											<Pencil class="size-4" />
											<span>{m.common_edit()}</span>
										</Menu.Item>
									</Menu.Content>
								</Menu.Positioner>
							</Portal>
						</Menu>
					</div>

					<div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
						<div>
							<span class="text-surface-500-500 text-sm">{m.form_book_cu_status_label()}</span>
							<div class="mt-1">
								<Menu
									onSelect={(event) => {
										console.debug('[status-reset] status menu fired:', event.value);
										requestBookStatus(event.value as BookStatus);
									}}
								>
									<Menu.Trigger class="btn w-full justify-between preset-tonal">
										<span class="flex items-center gap-2">
											{#if data.bookInfo.status === 'Wishlist'}<Heart
													class="size-4"
												/>{:else if data.bookInfo.status === 'Ordered'}<ShoppingCart
													class="size-4"
												/>{:else if data.bookInfo.status === 'Owned'}<BadgeCheck
													class="size-4"
												/>{:else}<Circle class="size-4" />{/if}
											{getBookStatusText(data.bookInfo.status)}
										</span>
									</Menu.Trigger>
									<Portal>
										<Menu.Positioner>
											<Menu.Content
												class="z-50 mt-2 flex w-fit flex-col gap-2 rounded-base border border-surface-200-800 preset-filled-surface-50-950 p-2 shadow-xl"
											>
												{#each bookValidation.bookStatusEnum.options as status (status)}
													<Menu.Item
														value={status}
														class={[
															'flex cursor-pointer items-center gap-2 rounded-base p-2 hover:preset-filled-primary-50-950',
															status === data.bookInfo.status && 'preset-filled-primary-50-950'
														]}
													>
														{#if status === 'Wishlist'}<Heart
																class="size-4"
															/>{:else if status === 'Ordered'}<ShoppingCart
																class="size-4"
															/>{:else if status === 'Owned'}<BadgeCheck
																class="size-4"
															/>{:else}<Circle class="size-4" />{/if}
														<span>{getBookStatusText(status)}</span>
													</Menu.Item>
												{/each}
											</Menu.Content>
										</Menu.Positioner>
									</Portal>
								</Menu>
							</div>
						</div>

						<div>
							<span class="text-surface-500-500 text-sm">{m.form_book_cu_readstatus_label()}</span>
							<div class="mt-1">
								<Menu
									onSelect={(event) => {
										bookReadStatusTarget.id = data.bookInfo.id;
										bookReadStatusValue = event.value as ReadStatus;
										confirmUpdateBookReadStatus();
									}}
								>
									<Menu.Trigger class="btn w-full justify-between preset-tonal">
										<span class="flex items-center gap-2">
											{#if data.bookInfo.readStatus === 'Not Read'}<Circle
													class="size-4"
												/>{:else if data.bookInfo.readStatus === 'Reading'}<BookOpen
													class="size-4"
												/>{:else if data.bookInfo.readStatus === 'Completed'}<CircleCheck
													class="size-4"
												/>{:else}<Circle class="size-4" />{/if}
											{getReadStatusText(data.bookInfo.readStatus)}
										</span>
									</Menu.Trigger>
									<Portal>
										<Menu.Positioner>
											<Menu.Content
												class="z-50 mt-2 flex w-fit flex-col gap-2 rounded-base border border-surface-200-800 preset-filled-surface-50-950 p-2 shadow-xl"
											>
												{#each bookValidation.readStatusEnum.options as rs (rs)}
													<Menu.Item
														value={rs}
														disabled={rs !== 'Not Read' && data.bookInfo.status !== 'Owned'}
														class={[
															'flex cursor-pointer items-center gap-2 rounded-base p-2 text-nowrap hover:preset-filled-primary-50-950 data-disabled:pointer-events-none data-disabled:opacity-50',
															rs === data.bookInfo.readStatus && 'preset-filled-primary-50-950'
														]}
													>
														{#if rs === 'Not Read'}<Circle
																class="size-4 shrink-0"
															/>{:else if rs === 'Reading'}<BookOpen
																class="size-4 shrink-0"
															/>{:else if rs === 'Completed'}<CircleCheck
																class="size-4 shrink-0"
															/>{:else}<Circle class="size-4 shrink-0" />{/if}
														<span>{getReadStatusText(rs)}</span>
													</Menu.Item>
												{/each}
											</Menu.Content>
										</Menu.Positioner>
									</Portal>
								</Menu>
							</div>
						</div>

						<div>
							<span class="text-surface-500-500 text-sm">{m.form_book_cu_isbn_label()}</span>
							<p class="font-medium">{data.bookInfo.isbn || '—'}</p>
						</div>

						{#if data.seriesInfo.author}
							<div>
								<span class="text-surface-500-500 text-sm">{m.book_detail_author_label()}</span>
								<p class="font-medium">{data.seriesInfo.author}</p>
							</div>
						{/if}

						<div>
							<span class="text-surface-500-500 text-sm">{m.book_detail_seriesstatus_label()}</span>
							<p class="font-medium">
								{getSeriesStatusText(data.seriesInfo.status)}
							</p>
						</div>
					</div>

					<div class="border-t border-surface-200-800 pt-4">
						<h2 class="mb-3 font-semibold">{m.book_detail_purchase_title()}</h2>
						<div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
							<div>
								<span class="text-surface-500-500 text-sm">{m.book_detail_paid_price_label()}</span>
								<p class="font-medium">
									{formatPrice(data.bookInfo.paidPrice, data.bookInfo.currencyCode)}
								</p>
							</div>
							<div>
								<span class="text-surface-500-500 text-sm">
									{m.book_detail_original_price_label()}
								</span>
								<p class="font-medium">
									{formatPrice(data.bookInfo.originalPrice, data.bookInfo.currencyCode)}
								</p>
							</div>
							{#if !data.bookOrder}
								<div>
									<span class="text-surface-500-500 text-sm">
										{m.book_detail_purchase_month_label()}
									</span>
									<p class="font-medium">{boughtAtMonth ?? '—'}</p>
								</div>
							{:else}
								<div>
									<span class="text-surface-500-500 text-sm">{m.book_detail_order_label()}</span>
									<a
										href={resolve(`orders/${data.bookOrder.id}`)}
										class="font-medium hover:underline"
									>
										{data.bookOrder.storeName}
										{#if data.bookOrder.orderNumber}
											({data.bookOrder.orderNumber}){/if}
									</a>
									<p class="text-surface-500-500 text-sm">
										{new Date(data.bookOrder.orderDate).toLocaleDateString()}
									</p>
								</div>
								{#if purchaseDateMismatch}
									<div>
										<span class="text-surface-500-500 text-sm">
											{m.book_detail_purchase_month_label()}
										</span>
										<div class="flex items-center gap-2">
											<p class="font-medium">{boughtAtMonth}</p>
											<Tooltip>
												<Tooltip.Trigger
													type="button"
													class="text-warning-500"
													aria-label={m.book_detail_purchase_warning_aria()}
												>
													<CircleAlert class="size-4" />
												</Tooltip.Trigger>
												<Portal>
													<Tooltip.Positioner>
														<Tooltip.Content
															class="z-100 max-w-60 card border border-surface-200-800 preset-filled-surface-50-950 p-2 text-sm shadow-xl"
														>
															{m.book_detail_purchase_mismatch()}
														</Tooltip.Content>
													</Tooltip.Positioner>
												</Portal>
											</Tooltip>
										</div>
									</div>
								{/if}
							{/if}
						</div>
					</div>

					<div class="border-t border-surface-200-800 pt-4">
						<h2 class="mb-3 font-semibold">
							{m.book_progress_section_title()}
						</h2>
						{#if data.bookInfo.status === 'Owned'}
							<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
								<DatePickerField
									label={m.form_book_cu_startedat_label()}
									value={startedAt}
									onValueChange={(value) => onDateChange('startedAt', value)}
								/>
								<DatePickerField
									label={m.form_book_cu_completedat_label()}
									value={completedAt}
									onValueChange={(value) => onDateChange('completedAt', value)}
								/>
								<label class="label">
									<span class="label-text">{m.form_book_cu_readcount_label()}</span>
									<input
										type="number"
										min="0"
										class="input"
										value={data.bookInfo.readCount}
										placeholder={m.form_book_cu_readcount_placeholder()}
										onchange={(e) => onReadCountChange(e.currentTarget)}
									/>
								</label>
							</div>
						{:else}
							<div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
								<div>
									<span class="text-surface-500-500 text-sm">
										{m.book_detail_startedat_label()}
									</span>
									<p class="font-medium">
										{formatDay(data.bookInfo.startedAt)}
									</p>
								</div>
								<div>
									<span class="text-surface-500-500 text-sm">
										{m.book_detail_completedat_label()}
									</span>
									<p class="font-medium">
										{formatDay(data.bookInfo.completedAt)}
									</p>
								</div>
								<div>
									<span class="text-surface-500-500 text-sm">
										{m.book_detail_readcount_label()}
									</span>
									<p class="font-medium">{data.bookInfo.readCount}</p>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</main>

{#if pendingStatusReset}
	<BookStatusResetDialog
		pending={pendingStatusReset}
		onConfirm={confirmReadReset}
		onCancel={cancelReadReset}
	/>
{/if}

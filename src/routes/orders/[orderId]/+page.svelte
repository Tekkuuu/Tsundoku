<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { createOrderAdjustment } from '$lib/components/forms/orders/createOrderAdjustment.remote';
	import { createOrderItem } from '$lib/components/forms/orders/createOrderItem.remote';
	import { deleteOrder } from '$lib/components/forms/orders/deleteOrder.remote';
	import { deleteOrderAdjustment } from '$lib/components/forms/orders/deleteOrderAdjustment.remote';
	import { deleteOrderItem } from '$lib/components/forms/orders/deleteOrderItem.remote';
	import { updateOrderAdjustment } from '$lib/components/forms/orders/updateOrderAdjustment.remote';
	import UpdateOrderDialog from '$lib/components/forms/orders/UpdateOrderDialog.svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	import { coverSrc } from '$lib/fileUrl';
	import { createEnhanceHandler, createRemoteActionHandler } from '$lib/utils/formUtils';
	import { m } from '$lib/paraglide/messages';
	import {
		type CreateOrderAdjustment,
		type CreateOrderItem,
		type UpdateOrder,
		type UpdateOrderAdjustment
	} from '$lib/validation/order';
	import {
		ArrowLeft,
		Calendar,
		Check,
		Dot,
		Ellipsis,
		FileText,
		Hash,
		Minus,
		Pencil,
		Plus,
		Receipt,
		ShoppingBag,
		Tags,
		Trash2,
		X
	} from '@lucide/svelte';
	import {
		Combobox,
		Menu,
		Portal,
		useListCollection,
		type ComboboxRootProps
	} from '@skeletonlabs/skeleton-svelte';
	import { format } from 'date-fns';
	import Fuse from 'fuse.js';

	let { data } = $props();

	const order = $derived(data.order);

	let editOrderOpen = $state(false);
	let editableOrder: UpdateOrder = $state({ id: '', orderDate: '', currencyCode: '' });

	let confirmDeleteOrderOpen = $state(false);

	const confirmDeleteOrder = createRemoteActionHandler({
		success: m.order_orderid_success_deleteorder(),
		error: m.order_orderid_error_deleteorder(),
		run: () => deleteOrder({ id: order.id }),
		onSuccess: async () => {
			confirmDeleteOrderOpen = false;
			await goto(resolve('/orders'));
		}
	});

	let pendingDeleteItemId = $state<string | null>(null);

	const confirmDeleteItem = createRemoteActionHandler({
		success: m.order_orderid_success_removebook(),
		error: m.order_orderid_error_removebook(),
		run: () => deleteOrderItem({ id: pendingDeleteItemId ?? '' }),
		onSuccess: () => {
			pendingDeleteItemId = null;
			invalidateAll();
		}
	});

	let editingAdjustmentId = $state<string | null>(null);

	function startEditAdjustment(adjustment: (typeof order.adjustments)[number]) {
		editingAdjustmentId = adjustment.id;
		updateOrderAdjustment.fields.set({
			id: adjustment.id,
			name: adjustment.name,
			amount: adjustment.amount
		});
	}

	function cancelEditAdjustment() {
		editingAdjustmentId = null;
	}

	const handleUpdateAdjustment = createEnhanceHandler<UpdateOrderAdjustment, void>({
		success: m.dialog_order_editadjustment_success(),
		invalidData: m.dialog_order_editadjustment_invalid_data(),
		error: m.dialog_order_editadjustment_error(),
		onSuccess: () => {
			editingAdjustmentId = null;
			invalidateAll();
		}
	});

	let pendingDeleteAdjustmentId = $state<string | null>(null);

	const confirmDeleteAdjustment = createRemoteActionHandler({
		success: m.order_orderid_success_removeadjustment(),
		error: m.order_orderid_error_removeadjustment(),
		run: () => deleteOrderAdjustment({ id: pendingDeleteAdjustmentId ?? '' }),
		onSuccess: () => {
			pendingDeleteAdjustmentId = null;
			invalidateAll();
		}
	});

	let addItemOpen = $state(false);
	let selectedBook = $state<string | undefined>('');

	let itemsBaseTotal = $derived(
		order.items.reduce((sum, item) => sum + Number(item.book.originalPrice ?? 0), 0)
	);

	let itemsPaidTotal = $derived(
		order.items.reduce((sum, item) => sum + Number(item.book.paidPrice ?? 0), 0)
	);

	let adjustmentsPaidTotal = $derived(
		order.adjustments.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
	);

	const bookItemsFuse = $derived(
		new Fuse(data.books, {
			keys: [
				{ name: 'title', weight: 0.7 },
				{ name: 'volumeNumber', weight: 0.3 }
			],
			threshold: 0.4,
			ignoreLocation: true
		})
	);

	let bookItems = $state<typeof data.books>([]);
	const booksCollection = $derived(
		useListCollection({
			items: bookItems,
			itemToString: (item) => `${item.title} - Vol. ${item.volumeNumber}`,
			itemToValue: (item) => item.id
		})
	);

	let isQueryTooBroad = $state(false);
	const booksFilter: ComboboxRootProps['onInputValueChange'] = (event) => {
		const query = event.inputValue?.trim() ?? '';

		if (!query) {
			bookItems = [];
			isQueryTooBroad = false;
			return;
		}

		const results = bookItemsFuse.search(query);

		if (results.length > 100) {
			bookItems = [];
			isQueryTooBroad = true;
		} else if (results.length > 0) {
			bookItems = results.map((result) => result.item);
			isQueryTooBroad = false;
		} else {
			bookItems = [];
			isQueryTooBroad = false;
		}
	};

	function resetItemForm() {
		selectedBook = undefined;
		bookItems = [];
		isQueryTooBroad = false;
		createOrderItem.fields.bookId.set('');
	}

	function toggleItemForm() {
		addItemOpen = !addItemOpen;
		if (!addItemOpen) resetItemForm();
	}

	const handleAddItem = createEnhanceHandler<CreateOrderItem, void>({
		success: m.dialog_order_addbook_success(),
		invalidData: m.dialog_order_addbook_invalid_data(),
		error: m.dialog_order_addbook_error(),
		onSuccess: () => {
			invalidateAll();
		}
	});

	let addAdjustmentOpen = $state(false);

	function resetAdjustmentForm() {
		createOrderAdjustment.fields.name.set('');
		createOrderAdjustment.fields.amount.set('');
	}

	function toggleAdjustmentForm() {
		addAdjustmentOpen = !addAdjustmentOpen;
		if (!addAdjustmentOpen) resetAdjustmentForm();
	}

	const handleAddAdjustment = createEnhanceHandler<CreateOrderAdjustment, void>({
		success: m.dialog_order_addadjustment_success(),
		invalidData: m.dialog_order_addadjustment_invalid_data(),
		error: m.dialog_order_addadjustment_error(),
		onSuccess: () => {
			addAdjustmentOpen = false;
			resetAdjustmentForm();
			invalidateAll();
		}
	});

	function openEditOrder() {
		editableOrder = {
			id: order.id,
			storeName: order.storeName ?? '',
			orderNumber: order.orderNumber ?? '',
			orderDate: order.orderDate ? format(new Date(order.orderDate), 'yyyy-MM-dd') : '',
			currencyCode: order.currencyCode ?? '',
			receiptUrl: order.receiptUrl ?? '',
			receiptFileId: order.receiptFileId ?? '',
			note: order.note ?? ''
		};
		editOrderOpen = true;
	}

	function handleOrderMenuSelect(value: string) {
		if (value === 'edit') openEditOrder();
		else if (value === 'delete') confirmDeleteOrderOpen = true;
	}

	function handleBookMenuSelect(item: (typeof order.items)[number], value: string) {
		if (value === 'remove') pendingDeleteItemId = item.id;
	}

	function handleAdjustmentMenuSelect(
		adjustment: (typeof order.adjustments)[number],
		value: string
	) {
		if (value === 'edit') startEditAdjustment(adjustment);
		else if (value === 'remove') pendingDeleteAdjustmentId = adjustment.id;
	}
</script>

{#snippet bookItem(item: (typeof data.order.items)[number])}
	{@const book = item.book}
	<li class="flex items-center gap-2">
		<a href={resolve(`/series/${book.seriesId}/${book.id}`)} class="shrink-0">
			<BookCover
				src={coverSrc(book)}
				alt={m.order_orderid_cover_alt({
					title: book.series.title,
					volumeNumber: book.volumeNumber
				})}
				imgClass="h-24 w-16 rounded-base object-cover"
				fallbackClass="h-24 w-16 rounded-base"
			/>
		</a>
		<div class="grid-col-1 grid grid-rows-3">
			<a href={resolve(`/series/${book.seriesId}/${book.id}`)} class="hover:underline">
				<p class="truncate">{book.series.title}</p>
			</a>
			<p class="text-surface-500">
				{m.order_orderid_entry_volume({ volumeNumber: book.volumeNumber })}
			</p>
			<p>
				{#if book.originalPrice && book.originalPrice !== '' && book.originalPrice !== book.paidPrice}
					<span class="text-success-500">{book.paidPrice ?? '—'}</span>
					{order.currencyCode} (<span class="text-error-500 line-through">{book.originalPrice}</span
					>)
				{:else}
					{book.paidPrice ?? '—'} {order.currencyCode}
				{/if}
			</p>
		</div>
		<div class="ml-auto shrink-0">
			<Menu onSelect={(event) => handleBookMenuSelect(item, event.value)}>
				<Menu.Trigger class="btn preset-tonal btn-sm" aria-label={m.common_more_actions()}>
					<Ellipsis class="size-4" />
				</Menu.Trigger>
				<Portal>
					<Menu.Positioner>
						<Menu.Content
							class="z-50 flex w-48 flex-col gap-1 card border border-surface-200-800 bg-surface-50-950 p-2 shadow-xl"
						>
							<Menu.Item
								value="remove"
								class="flex cursor-pointer items-center gap-2 rounded-base p-2 hover:preset-filled-primary-50-950"
							>
								<Trash2 class="size-4" />
								<span>{m.common_remove()}</span>
							</Menu.Item>
						</Menu.Content>
					</Menu.Positioner>
				</Portal>
			</Menu>
		</div>
	</li>
{/snippet}

<main class="p-2">
	<div class="mx-auto flex max-w-6xl flex-col gap-2">
		<a href={resolve('/orders')} class="btn self-start preset-tonal">
			<ArrowLeft class="size-4" />
			{m.orders_title()}
		</a>

		{#if order}
			<section class="space-y-2 card bg-surface-100-900 p-4">
				<div class="flex flex-wrap items-start justify-between gap-2">
					<div class="space-y-1">
						<h1 class="text-2xl font-bold">
							{order.storeName || m.order_orderid_nostore()}
						</h1>

						<div class="flex flex-wrap items-center gap-2 text-sm text-surface-500">
							{#if order.orderDate}
								<div class="flex items-center gap-2">
									<Calendar class="size-4" />
									<span>{format(new Date(order.orderDate), 'yyyy-MM-dd')}</span>
								</div>
							{/if}
							{#if order.orderDate && order.orderNumber}
								<Dot />
							{/if}
							{#if order.orderNumber}
								<div class="flex items-center gap-2">
									<Hash class="size-4" />
									<span>{order.orderNumber}</span>
								</div>
							{/if}
						</div>
					</div>

					<div class="flex gap-2">
						{#if order.receiptFileId}
							<a
								href={resolve(`/files/${order.receiptFileId}`)}
								target="_blank"
								rel="noreferrer"
								class="btn flex w-full items-center gap-2 preset-filled-primary-500 btn-sm sm:w-fit"
							>
								<Receipt class="size-4" />
								<span>{m.order_orderid_viewreceipt()}</span>
							</a>
						{:else if order.receiptUrl}
							<a
								href={order.receiptUrl}
								target="_blank"
								rel="noreferrer"
								class="btn flex w-full items-center gap-2 preset-filled-primary-500 btn-sm sm:w-fit"
							>
								<Receipt class="size-4" />
								<span>{m.order_orderid_viewreceipt()}</span>
							</a>
						{/if}
						<Menu onSelect={(event) => handleOrderMenuSelect(event.value)}>
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
				</div>

				{#if order.note}
					<div class="flex items-center gap-2 rounded-container preset-tonal p-2 text-sm">
						<FileText class="size-4 shrink-0" />
						<p>{order.note}</p>
					</div>
				{/if}
			</section>

			<section class="flex flex-col gap-2 card bg-surface-100-900 p-4">
				<div class="flex items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<ShoppingBag />
						<h1 class="text-2xl font-bold">{m.order_orderid_books_title()}</h1>
					</div>
					<button type="button" class="btn preset-filled btn-sm" onclick={toggleItemForm}>
						{#if addItemOpen}
							<X class="size-4" />
						{:else}
							<Plus class="size-4" />
						{/if}
						{m.order_orderid_addbook()}
					</button>
				</div>

				{#if addItemOpen}
					<form {...createOrderItem.enhance(handleAddItem)} class="space-y-2">
						<input {...createOrderItem.fields.bookId.as('hidden', selectedBook || '')} />
						<Combobox
							class="w-full"
							placeholder={m.common_search_placeholder()}
							collection={booksCollection}
							onInputValueChange={booksFilter}
							onSelect={(e) => {
								selectedBook = e.value.at(0);
							}}
						>
							<Combobox.Control>
								<Combobox.Input />
								<Combobox.Trigger />
							</Combobox.Control>
							<div class="flex flex-col gap-2 sm:flex-row">
								<Combobox.ClearTrigger
									class="w-full sm:w-auto"
									onclick={() => {
										selectedBook = undefined;
									}}
								>
									{m.common_clear_all()}
								</Combobox.ClearTrigger>
								<button type="submit" class="btn w-full preset-filled sm:flex-1">
									{m.dialog_order_addbook_submit()}
								</button>
							</div>
							<Portal>
								<Combobox.Positioner>
									<Combobox.Content>
										{#if isQueryTooBroad}
											<div class="p-2 text-sm text-surface-500">
												{m.order_detail_too_many()}
											</div>
										{:else if bookItems.length === 0}
											<div class="p-2 text-sm text-surface-500">
												{m.order_detail_type_search()}
											</div>
										{:else}
											{#each bookItems as item (item.id)}
												<Combobox.Item {item}>
													<Combobox.ItemText>
														{`${item.title} - Vol. ${item.volumeNumber}`}
													</Combobox.ItemText>
													<Combobox.ItemIndicator />
												</Combobox.Item>
											{/each}
										{/if}
									</Combobox.Content>
								</Combobox.Positioner>
							</Portal>
						</Combobox>
						{#each createOrderItem.fields.bookId.issues() as issue (issue.message)}
							<p class="text-sm text-error-500">{issue.message}</p>
						{/each}
					</form>
				{/if}

				{#if order.items.length > 0}
					<ul class="space-y-2">
						{#each order.items as item (item.book.id)}
							{@render bookItem(item)}
						{/each}
					</ul>
				{:else}
					<p class="text-surface-500-500">{m.order_orderid_books_empty()}</p>
				{/if}

				<hr class="divide-x text-surface-500" />

				<div class="ml-auto">
					<h3 class="text-xl font-bold">
						{#if itemsBaseTotal !== itemsPaidTotal}
							<span class="text-success-500">{itemsPaidTotal}</span>
							{order.currencyCode} (<span class="text-error-500 line-through"
								>{itemsBaseTotal.toFixed(2)}</span
							>)
						{:else}
							{itemsPaidTotal.toFixed(2)} {order.currencyCode}
						{/if}
					</h3>
				</div>
			</section>

			<section class="card bg-surface-100-900 p-4">
				<div class="mb-2 flex items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<Tags class="size-5" />
						<h2 class="text-xl font-semibold">{m.order_orderid_discountsfees_title()}</h2>
					</div>
					<button type="button" class="btn preset-filled btn-sm" onclick={toggleAdjustmentForm}>
						{#if addAdjustmentOpen}
							<X class="size-4" />
						{:else}
							<Plus class="size-4" />
						{/if}
						{m.dialog_order_addadjustment_button()}
					</button>
				</div>

				{#if addAdjustmentOpen}
					<form {...createOrderAdjustment.enhance(handleAddAdjustment)} class="space-y-2">
						<div class="grid grid-cols-1 gap-2 sm:field-group sm:grid-cols-[4fr_1fr_1fr]">
							<input
								class="input"
								{...createOrderAdjustment.fields.name.as('text')}
								placeholder={m.form_orderadjustment_name_placeholder()}
							/>
							<input
								class="input"
								inputmode="decimal"
								step="0.01"
								{...createOrderAdjustment.fields.amount.as('text')}
								placeholder={m.form_orderadjustment_amount_placeholder()}
							/>
							<button type="submit" class="btn w-full preset-filled">
								{m.dialog_order_addadjustment_submit()}
							</button>
						</div>
						{#if createOrderAdjustment.fields.name.issues() || createOrderAdjustment.fields.amount.issues()}
							<div class="grid grid-cols-1 gap-1 sm:grid-cols-[4fr_1fr_1fr]">
								{#each createOrderAdjustment.fields.name.issues() as issue (issue.message)}
									<p class="text-sm text-error-500">{issue.message}</p>
								{/each}
								{#each createOrderAdjustment.fields.amount.issues() as issue (issue.message)}
									<p class="text-sm text-error-500">{issue.message}</p>
								{/each}
							</div>
						{/if}
					</form>
				{/if}

				{#if order.adjustments.length > 0}
					<ul>
						{#each order.adjustments as adjustment (adjustment.id)}
							{#if editingAdjustmentId === adjustment.id}
								<form
									{...updateOrderAdjustment.enhance(handleUpdateAdjustment)}
									class="space-y-2 py-2"
								>
									<input
										{...updateOrderAdjustment.fields.id.as('hidden', editingAdjustmentId ?? '')}
									/>
									<div
										class="field-group grid grid-cols-1 gap-2 sm:grid-cols-[4fr_1fr_0.5fr_0.5fr]"
									>
										<input
											class="input field-sm"
											{...updateOrderAdjustment.fields.name.as('text')}
											placeholder={m.form_orderadjustment_name_placeholder()}
										/>
										<input
											class="input field-sm"
											inputmode="decimal"
											step="0.01"
											{...updateOrderAdjustment.fields.amount.as('text')}
											placeholder={m.form_orderadjustment_amount_placeholder()}
										/>
										<button type="submit" class="btn w-full preset-filled-primary-500 btn-sm">
											<Check />
										</button>
										<button
											type="button"
											class="btn w-full preset-tonal btn-sm"
											onclick={cancelEditAdjustment}
										>
											<X />
										</button>
									</div>
									{#if updateOrderAdjustment.fields.name.issues() || updateOrderAdjustment.fields.amount.issues()}
										<div class="grid grid-cols-1 gap-1 sm:grid-cols-[4fr_1fr_1fr]">
											{#each updateOrderAdjustment.fields.name.issues() as issue (issue.message)}
												<p class="text-sm text-error-500">{issue.message}</p>
											{/each}
											{#each updateOrderAdjustment.fields.amount.issues() as issue (issue.message)}
												<p class="text-sm text-error-500">{issue.message}</p>
											{/each}
										</div>
									{/if}
								</form>
							{:else}
								<li class="flex items-center gap-2 py-2">
									<div class="flex w-full justify-between">
										<div class="flex items-center gap-2">
											<span>{adjustment.name}</span>
										</div>
										<span class="flex gap-2">
											<span
												class={[
													Number(adjustment.amount) >= 0 ? 'text-error-500' : 'text-success-500',
													'flex items-center'
												]}
											>
												{#if Number(adjustment.amount) >= 0}
													<Plus class="mt-0.5 size-4" />
												{:else}
													<Minus class="mt-0.5 size-4" />
												{/if}
												{Math.abs(Number(adjustment.amount))}
											</span>
											{order.currencyCode}
										</span>
									</div>
									<Menu onSelect={(event) => handleAdjustmentMenuSelect(adjustment, event.value)}>
										<Menu.Trigger
											class="btn preset-tonal btn-sm"
											aria-label={m.common_more_actions()}
										>
											<Ellipsis class="size-4" />
										</Menu.Trigger>
										<Portal>
											<Menu.Positioner>
												<Menu.Content
													class="z-50 flex w-56 flex-col gap-1 card border border-surface-200-800 bg-surface-50-950 p-2 shadow-xl"
												>
													<Menu.Item
														value="edit"
														class="flex cursor-pointer items-center gap-2 rounded-base p-2 hover:preset-filled-primary-50-950"
													>
														<Pencil class="size-4" />
														<span>{m.common_edit()}</span>
													</Menu.Item>
													<Menu.Item
														value="remove"
														class="flex cursor-pointer items-center gap-2 rounded-base p-2 hover:preset-filled-primary-50-950"
													>
														<Trash2 class="size-4" />
														<span>{m.order_orderid_removeadjustment_aria()}</span>
													</Menu.Item>
												</Menu.Content>
											</Menu.Positioner>
										</Portal>
									</Menu>
								</li>
							{/if}
						{/each}
					</ul>
				{:else}
					<p class="p-2 text-surface-500">{m.order_orderid_discounts_empty()}</p>
				{/if}
			</section>

			<section class="card bg-surface-100-900 p-4">
				<h2 class="mb-3 text-xl font-bold">{m.order_detail_summary_title()}</h2>

				<div class="ml-auto w-full max-w-xs space-y-1.5 text-sm tabular-nums">
					<div class="flex items-center justify-between text-surface-600-400">
						<span>{m.order_orderid_subtotal()}</span>
						<span class="font-medium text-surface-900-100">
							{itemsPaidTotal.toFixed(2)}
							{order.currencyCode}
						</span>
					</div>

					<div class="flex items-center justify-between text-surface-600-400">
						<span>{m.order_detail_adjustments_label()}</span>
						<span
							class="font-medium {adjustmentsPaidTotal < 0
								? 'text-success-600-400'
								: adjustmentsPaidTotal > 0
									? 'text-error-600-400'
									: 'text-surface-900-100'}"
						>
							{adjustmentsPaidTotal > 0 ? '+' : ''}{adjustmentsPaidTotal.toFixed(2)}
							{order.currencyCode}
						</span>
					</div>

					<hr class="my-2 border-surface-300-700" />

					<div class="flex items-baseline justify-between pt-1">
						<span class="text-base font-bold text-surface-900-100">{m.order_orderid_total()}</span>
						<span class="text-lg font-bold text-primary-500">
							{(itemsPaidTotal + adjustmentsPaidTotal).toFixed(2)}
							{order.currencyCode}
						</span>
					</div>
				</div>
			</section>

			<UpdateOrderDialog
				order={editableOrder}
				bind:open={editOrderOpen}
				currencyLocked={order.items.length > 0}
			/>

			<ConfirmDialog
				open={confirmDeleteOrderOpen}
				title={m.order_orderid_confirmdelete_title()}
				message={m.order_orderid_confirmdelete_order_message()}
				onOpenChange={(e) => (confirmDeleteOrderOpen = e.open)}
				onConfirm={confirmDeleteOrder}
			/>

			<ConfirmDialog
				open={pendingDeleteItemId !== null}
				title={m.order_orderid_confirmdelete_title()}
				message={m.order_orderid_confirmdelete_item_message()}
				onOpenChange={(e) => !e.open && (pendingDeleteItemId = null)}
				onConfirm={confirmDeleteItem}
			/>

			<ConfirmDialog
				open={pendingDeleteAdjustmentId !== null}
				title={m.order_orderid_confirmdelete_title()}
				message={m.order_orderid_confirmdelete_adjustment_message()}
				onOpenChange={(e) => !e.open && (pendingDeleteAdjustmentId = null)}
				onConfirm={confirmDeleteAdjustment}
			/>
		{/if}
	</div>
</main>

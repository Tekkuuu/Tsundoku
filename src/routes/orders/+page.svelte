<script lang="ts">
	import { Pencil, Receipt, Trash2, Plus, Ellipsis } from '@lucide/svelte';
	import { format } from 'date-fns';
	import Fuse from 'fuse.js';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import { m } from '$lib/paraglide/messages';
	import { createRemoteActionHandler } from '$lib/utils/formUtils';
	import CreateOrderDialog from '$lib/components/forms/orders/CreateOrderDialog.svelte';
	import UpdateOrderDialog from '$lib/components/forms/orders/UpdateOrderDialog.svelte';
	import { deleteOrder } from '$lib/components/forms/orders/deleteOrder.remote';
	import { type UpdateOrder } from '$lib/validation/order';
	import SearchHelpPopover from '$lib/components/SearchHelpPopover.svelte';
	import { filterSearch, type SearchField } from '$lib/utils/search';

	let { data } = $props();

	const sortedOrders = $derived(
		data.orders.toSorted((a, b) => {
			const aTime = a.orderDate ? new Date(a.orderDate).getTime() : 0;
			const bTime = b.orderDate ? new Date(b.orderDate).getTime() : 0;
			return bTime - aTime;
		})
	);

	let searchQuery = $state('');

	type OrderEntry = (typeof data.orders)[number];

	type OrderItemSearchDoc = {
		orderId: string;
		volumeNumber: string;
		paidPrice: string;
		originalPrice: string;
		title: string;
		author: string;
	};
	const searchFields: Record<string, SearchField<OrderEntry>> = {
		order: { type: 'text', get: (order) => order.orderNumber },
		store: { type: 'text', get: (order) => order.storeName },
		note: { type: 'text', get: (order) => order.note },
		date: { type: 'date', get: (order) => order.orderDate },
		title: { type: 'text', get: (order) => order.items.map((i) => i.book.series.title) },
		author: { type: 'text', get: (order) => order.items.map((i) => i.book.series.author) },
		volume: { type: 'number', get: (order) => order.items.map((i) => i.book.volumeNumber) },
		paidprice: { type: 'number', get: (order) => order.items.map((i) => i.book.paidPrice) },
		originalprice: { type: 'number', get: (order) => order.items.map((i) => i.book.originalPrice) }
	};

	const filteredOrders = $derived(
		filterSearch(sortedOrders, searchQuery, searchFields, (order, value) =>
			matchedOrderIds(value).has(order.id)
		)
	);

	// Shared fuzzy indexes, built once per dataset instead of per order per keystroke.
	const orderFuse = $derived(
		new Fuse(sortedOrders, {
			keys: ['orderNumber', 'storeName', 'note'],
			threshold: 0.4,
			ignoreLocation: true
		})
	);
	const orderItemFuse = $derived(
		new Fuse<OrderItemSearchDoc>(
			sortedOrders.flatMap((order) =>
				order.items.map((i) => ({
					orderId: order.id,
					volumeNumber: String(i.book.volumeNumber),
					paidPrice: String(i.book.paidPrice ?? ''),
					originalPrice: String(i.book.originalPrice ?? ''),
					title: i.book.series.title ?? '',
					author: i.book.series.author ?? ''
				}))
			),
			{
				keys: ['volumeNumber', 'paidPrice', 'originalPrice', 'title', 'author'],
				threshold: 0.4,
				ignoreLocation: true
			}
		)
	);

	// Memoized per-search-value id sets; dropped whenever the orders change.
	let matchCache: { entries: OrderEntry[]; ids: Map<string, Set<string>> } | null = null;

	function matchedOrderIds(value: string): Set<string> {
		if (!matchCache || matchCache.entries !== sortedOrders) {
			matchCache = { entries: sortedOrders, ids: new Map() };
		}
		let ids = matchCache.ids.get(value);
		if (!ids) {
			ids = new Set<string>([
				...orderFuse.search(value).map((result) => result.item.id),
				...orderItemFuse.search(value).map((result) => result.item.orderId)
			]);
			matchCache.ids.set(value, ids);
		}
		return ids;
	}

	let editOrderOpen = $state(false);
	let editableOrder: UpdateOrder = $state({ id: '', orderDate: '', currencyCode: '' });

	// The order currency is locked server-side while the order has books.
	const editOrderCurrencyLocked = $derived(
		(data.orders.find((o) => o.id === editableOrder.id)?.items.length ?? 0) > 0
	);

	let pendingDeleteOrderId = $state<string | null>(null);

	const confirmDeleteOrder = createRemoteActionHandler({
		success: m.orders_success_deleteorder(),
		error: m.orders_error_deleteorder(),
		run: () => deleteOrder({ id: pendingDeleteOrderId ?? '' }),
		onSuccess: () => {
			pendingDeleteOrderId = null;
			invalidateAll();
		}
	});

	function calculateOrderTotal(order: (typeof data.orders)[number]): number {
		const itemsTotal = order.items.reduce((sum, item) => {
			return sum + Number(item.book.paidPrice ?? 0);
		}, 0);

		const adjustmentsTotal = order.adjustments.reduce((sum, item) => {
			return sum + Number(item.amount ?? 0);
		}, 0);

		return itemsTotal + adjustmentsTotal;
	}

	function openEditOrder(orderEntry: (typeof data.orders)[number]) {
		editableOrder = {
			id: orderEntry.id,
			storeName: orderEntry.storeName ?? '',
			orderNumber: orderEntry.orderNumber ?? '',
			orderDate: orderEntry.orderDate ? format(new Date(orderEntry.orderDate), 'yyyy-MM-dd') : '',
			currencyCode: orderEntry.currencyCode ?? '',
			receiptUrl: orderEntry.receiptUrl ?? '',
			receiptFileId: orderEntry.receiptFileId ?? '',
			note: orderEntry.note ?? ''
		};
		editOrderOpen = true;
	}

	function openDeleteOrder(orderEntry: (typeof data.orders)[number]) {
		pendingDeleteOrderId = orderEntry.id;
	}

	function handleOrderMenuSelect(orderEntry: (typeof data.orders)[number], value: string) {
		if (value === 'edit') openEditOrder(orderEntry);
		else if (value === 'delete') openDeleteOrder(orderEntry);
	}
</script>

{#snippet listItem(orderEntry: (typeof data.orders)[number])}
	<div class="flex items-center gap-2 card bg-surface-100-900 p-2 hover:preset-tonal-primary">
		<a href={resolve(`/orders/${orderEntry.id}`)} class="flex flex-1 flex-col gap-1">
			<div class="flex items-center justify-between gap-2">
				<span class="font-medium">{orderEntry.orderNumber || '-'}</span>
				<span class="text-sm opacity-70">
					{orderEntry.orderDate ? format(new Date(orderEntry.orderDate), 'yyyy-MM-dd') : '-'}
				</span>
			</div>
			<div class="flex items-center justify-between gap-2 text-sm">
				<span class="opacity-70">{orderEntry.storeName || '-'}</span>
				<span>
					{m.orders_entry_items({ count: orderEntry.items.length })}
					· {calculateOrderTotal(orderEntry).toFixed(2)}
					{orderEntry.currencyCode}
				</span>
			</div>
		</a>
		{#if orderEntry.receiptFileId}
			<a
				href={resolve(`/files/${orderEntry.receiptFileId}`)}
				target="_blank"
				class="preset-tonal-primary-500 btn btn-sm"
			>
				<Receipt />
			</a>
		{:else if orderEntry.receiptUrl}
			<a href={orderEntry.receiptUrl} target="_blank" class="preset-tonal-primary-500 btn btn-sm">
				<Receipt />
			</a>
		{/if}
		<Menu onSelect={(event) => handleOrderMenuSelect(orderEntry, event.value)}>
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
{/snippet}

<main class="p-2">
	<div class="mx-auto flex max-w-6xl flex-col items-center gap-2">
		<CreateOrderDialog triggerClass="btn preset-filled w-full">
			<Plus />
			{m.orders_addneworder()}
		</CreateOrderDialog>

		<div class="mb-2 flex w-full items-center justify-between">
			<h1 class="text-2xl font-bold">{m.orders_title()}</h1>
		</div>

		<div class="w-full">
			<SearchHelpPopover
				bind:value={searchQuery}
				placeholder={m.orders_search_placeholder()}
				title={m.orders_search_help_title()}
				description={m.orders_search_help_description()}
				fieldsTitle={m.orders_search_help_fields_title()}
				fields={[
					'order',
					'store',
					'title',
					'author',
					'volume',
					'paidprice',
					'originalprice',
					'date',
					'note'
				]}
				examplesTitle={m.orders_search_help_examples_title()}
				examples={[
					'store:Amazon',
					'title:Berserk',
					'title:"Attack on Titan"',
					'paidprice:>10',
					'date:>=2024-01-01',
					'-store:Amazon',
					'store:Amazon paidprice:>10'
				]}
				operators={m.orders_search_help_operators()}
			/>
		</div>

		<div class="flex w-full flex-col gap-1">
			{#each filteredOrders as orderEntry (orderEntry.id)}
				{@render listItem(orderEntry)}
			{/each}
		</div>

		{#if data.orders.length === 0}
			<p class="text-surface-500">{m.orders_empty()}</p>
		{/if}

		<UpdateOrderDialog
			order={editableOrder}
			bind:open={editOrderOpen}
			currencyLocked={editOrderCurrencyLocked}
		/>

		<ConfirmDialog
			open={pendingDeleteOrderId !== null}
			title={m.orders_confirmdelete_title()}
			message={m.orders_confirmdelete_message()}
			onOpenChange={(e) => !e.open && (pendingDeleteOrderId = null)}
			onConfirm={confirmDeleteOrder}
		/>
	</div>
</main>

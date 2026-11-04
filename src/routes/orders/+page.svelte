<script lang="ts">
	import { Pencil, Receipt, Trash2, Plus, Ellipsis } from '@lucide/svelte';
	import { format } from 'date-fns';
	import { resolve } from '$app/paths';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { createRemoteActionHandler } from '#lib/client/form-handlers.js';
	import CreateOrderDialog from '#lib/components/orders/CreateOrderDialog.svelte';
	import UpdateOrderDialog from '#lib/components/orders/UpdateOrderDialog.svelte';
	import { deleteOrder, getOrders } from '#lib/remote/orders.remote.js';
	import { type UpdateOrder } from '#lib/shared/validation/order.js';
	import SearchHelpPopover from '#lib/components/ui/SearchHelpPopover.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { snapshot } from '$app/navigation';

	type OrdersResult = Awaited<ReturnType<typeof getOrders>>;
	type OrderEntry = OrdersResult['orders'][number];

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

	function createOrdersQuery(targetPage: number) {
		return getOrders({
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
				query: createOrdersQuery(candidate)
			}));
	});
	const ordersQuery = $derived(
		pageQueries.find((candidate) => candidate.page === page)?.query ?? createOrdersQuery(page)
	);
	const ordersPage = $derived(ordersQuery.current);

	$effect(() => {
		if (ordersPage) lastTotal = ordersPage.total;
	});

	// Reading `current` starts the request; the derived array keeps it cached.
	$effect(() => {
		for (const candidate of pageQueries) {
			void candidate.query.current;
		}
	});

	const total = $derived(ordersPage?.total ?? lastTotal);
	const orders = $derived(ordersPage?.orders ?? []);
	const skeletonSlots = $derived(Array.from({ length: perPage }, (_, index) => index));

	// Ensure that after deleting last item from a page we move the prev page.
	$effect(() => {
		if (!ordersPage) return;

		const pageCount = Math.max(1, Math.ceil(ordersPage.total / perPage));
		if (page > pageCount) page = pageCount;
	});

	let editOrderOpen = $state(false);
	let editableOrder: UpdateOrder = $state({
		id: '',
		orderDate: '',
		currencyCode: ''
	});

	// The order currency is locked server-side while the order has books.
	const editOrderCurrencyLocked = $derived(
		(orders.find((o) => o.id === editableOrder.id)?.items.length ?? 0) > 0
	);

	let pendingDeleteOrderId = $state<string | null>(null);

	const confirmDeleteOrder = createRemoteActionHandler({
		success: m.orders_success_deleteorder(),
		error: m.orders_error_deleteorder(),
		run: () => deleteOrder({ id: pendingDeleteOrderId ?? '' }),
		onSuccess: async () => {
			pendingDeleteOrderId = null;
			await ordersQuery.refresh();
		}
	});

	function calculateOrderTotal(order: OrderEntry): number {
		const itemsTotal = order.items.reduce((sum, item) => {
			return sum + Number(item.book.paidPrice ?? 0);
		}, 0);

		const adjustmentsTotal = order.adjustments.reduce((sum, item) => {
			return sum + Number(item.amount ?? 0);
		}, 0);

		return itemsTotal + adjustmentsTotal;
	}

	function openEditOrder(orderEntry: OrderEntry) {
		editableOrder = {
			id: orderEntry.id,
			storeName: orderEntry.storeName ?? '',
			orderNumber: orderEntry.orderNumber ?? '',
			orderDate: orderEntry.orderDate ? format(new Date(orderEntry.orderDate), 'yyyy-MM-dd') : '',
			currencyCode: orderEntry.currencyCode ?? '',
			receiptFileId: orderEntry.receiptFileId ?? '',
			note: orderEntry.note ?? ''
		};
		editOrderOpen = true;
	}

	function openDeleteOrder(orderEntry: OrderEntry) {
		pendingDeleteOrderId = orderEntry.id;
	}

	function handleOrderMenuSelect(orderEntry: OrderEntry, value: string) {
		if (value === 'edit') openEditOrder(orderEntry);
		else if (value === 'delete') openDeleteOrder(orderEntry);
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

{#snippet listItem(orderEntry: OrderEntry)}
	<div
		class="flex items-center gap-2 card bg-surface-100-900 p-2 hover:preset-filled-surface-200-800"
	>
		<a href={resolve(`orders/${orderEntry.id}`)} class="flex flex-1 flex-col gap-1">
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
				href={resolve(`files/${orderEntry.receiptFileId}`)}
				target="_blank"
				class="preset-tonal-primary-500 btn btn-sm"
			>
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

{#snippet skeletonItem()}
	<div class="flex items-center gap-2 card bg-surface-100-900 p-2">
		<div class="flex flex-1 flex-col gap-1">
			<div class="flex items-center justify-between gap-2">
				<div class="h-5 w-28 animate-pulse rounded bg-surface-300-700"></div>
				<div class="h-4 w-20 animate-pulse rounded bg-surface-300-700"></div>
			</div>
			<div class="flex items-center justify-between gap-2">
				<div class="h-4 w-32 animate-pulse rounded bg-surface-300-700"></div>
				<div class="h-4 w-28 animate-pulse rounded bg-surface-300-700"></div>
			</div>
		</div>
	</div>
{/snippet}

<main class="container flex flex-col gap-2">
	<div class="flex w-full gap-2">
		<CreateOrderDialog triggerClass="btn preset-filled w-fit">
			<Plus />
			{m.orders_addneworder()}
		</CreateOrderDialog>

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

	{#if ordersPage}
		<div class="flex w-full flex-col gap-1">
			{#each orders as orderEntry (orderEntry.id)}
				{@render listItem(orderEntry)}
			{/each}
		</div>

		{#if orders.length === 0}
			<p class="py-8 text-center text-surface-500">{m.orders_empty()}</p>
		{/if}
	{:else if ordersQuery.error}
		<p class="py-8 text-center text-surface-500">{m.error_description()}</p>
	{:else}
		<div class="flex w-full flex-col gap-1" aria-hidden="true">
			{#each skeletonSlots as slot (slot)}
				{@render skeletonItem()}
			{/each}
		</div>
	{/if}

	{#if total > 0 && !ordersQuery.error}
		<Pagination bind:page count={total} bind:perPage class="w-full" />
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
</main>

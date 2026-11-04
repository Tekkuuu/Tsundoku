<script lang="ts">
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { createOrder } from '#lib/remote/orders.remote.js';
	import { getUniqueStores } from '#lib/remote/stores.remote.js';
	import { type CreateOrder } from '#lib/shared/validation/order.js';
	import { createEnhanceHandler } from '#lib/client/form-handlers.js';
	import { format } from 'date-fns';
	import CurrencyCodeInput from '#lib/components/form/CurrencyCodeInput.svelte';
	import FileAttachment from '#lib/components/form/FileAttachment.svelte';
	import FilePreview from '#lib/components/form/FilePreview.svelte';

	type Props = {
		triggerClass?: string;
		children?: Snippet;
	};

	let { children, triggerClass }: Props = $props();

	let open = $state(false);
	let stores = $state(getUniqueStores());

	let receiptFileId = $state('');

	$effect(() => {
		if (!open) receiptFileId = '';
	});

	$effect(() => {
		createOrder.fields.receiptFileId.set(receiptFileId);
	});

	const handleEnhance = createEnhanceHandler<CreateOrder, void>({
		success: m.dialog_order_add_success(),
		invalidData: m.dialog_order_add_invalid_data(),
		error: m.dialog_order_add_error(),
		onSuccess: () => {
			open = false;
		}
	});
</script>

<Dialog bind:open {triggerClass} size={receiptFileId ? 'xl' : 'sm'}>
	{#snippet trigger()}
		{@render children?.()}
	{/snippet}
	{#snippet dialogTitle()}
		{m.dialog_order_add_title()}
	{/snippet}
	{#snippet content()}
		<div class="grid grid-cols-1 gap-4 {receiptFileId ? 'lg:grid-cols-2' : ''}">
			<form {...createOrder.enhance(handleEnhance)} class="min-w-0 space-y-2">
				<label class="label">
					<span class="label-text">{m.form_order_cu_storename_label()}</span>
					<input
						class="input"
						{...createOrder.fields.storeName.as('text')}
						placeholder={m.form_order_cu_storename_placeholder()}
						list="storeNames"
					/>
					{#each createOrder.fields.storeName.issues() as issue (issue.message)}
						<p class="text-sm text-error-500">{issue.message}</p>
					{/each}
				</label>

				{#await stores then storesAwaited}
					<datalist id="storeNames">
						{#each storesAwaited as s}
							<option value={s}>{s}</option>
						{/each}
					</datalist>
				{/await}

				<label class="label">
					<span class="label-text">{m.form_order_cu_ordernumber_label()}</span>
					<input
						class="input"
						{...createOrder.fields.orderNumber.as('text')}
						placeholder={m.form_order_cu_ordernumber_placeholder()}
					/>
					{#each createOrder.fields.orderNumber.issues() as issue (issue.message)}
						<p class="text-sm text-error-500">{issue.message}</p>
					{/each}
				</label>

				<label class="label">
					<span class="label-text">{m.form_order_cu_orderdate_label()}</span>
					<input
						class="input"
						{...createOrder.fields.orderDate.as('date', format(new Date(), 'yyyy-MM-dd'))}
					/>
					{#each createOrder.fields.orderDate.issues() as issue (issue.message)}
						<p class="text-sm text-error-500">{issue.message}</p>
					{/each}
				</label>

				<CurrencyCodeInput
					bind:selected={
						() => createOrder.fields.currencyCode.value() || null,
						(v) => createOrder.fields.currencyCode.set(v ?? undefined)
					}
				/>
				<input
					{...createOrder.fields.currencyCode.as(
						'hidden',
						createOrder.fields.currencyCode.value() ?? ''
					)}
				/>
				{#each createOrder.fields.currencyCode.issues() as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}

				<FileAttachment kind="receipt" bind:value={receiptFileId} />
				<input {...createOrder.fields.receiptFileId.as('hidden', receiptFileId)} />
				{#each createOrder.fields.receiptFileId.issues() as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}

				<label class="label">
					<span class="label-text">{m.form_order_cu_note_label()}</span>
					<input
						class="input"
						{...createOrder.fields.note.as('text')}
						placeholder={m.form_order_cu_note_placeholder()}
					/>
					{#each createOrder.fields.note.issues() as issue (issue.message)}
						<p class="text-sm text-error-500">{issue.message}</p>
					{/each}
				</label>

				<button type="submit" class="btn w-full preset-filled-primary-500">
					{m.dialog_order_add_submit()}
				</button>
			</form>

			<FilePreview fileId={receiptFileId} class="lg:min-h-120" />
		</div>
	{/snippet}
</Dialog>

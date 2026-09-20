<script lang="ts">
	import { Dialog } from '$lib/components/composition';
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages';
	import { createOrder } from '$lib/components/forms/orders/createOrder.remote';
	import { type CreateOrder } from '$lib/validation/order';
	import { createEnhanceHandler } from '$lib/utils/formUtils';
	import { format } from 'date-fns';
	import CurrencyCodeInput from '$lib/components/CurrencyCodeInput.svelte';
	import FileAttachment from '$lib/components/forms/FileAttachment.svelte';

	type Props = {
		triggerClass?: string;
		children?: Snippet;
	};

	let { children, triggerClass }: Props = $props();

	let open = $state(false);

	let receiptFileId = $state('');

	$effect(() => {
		if (!open) receiptFileId = '';
	});

	$effect(() => {
		createOrder.fields.receiptFileId.set(receiptFileId);
	});

	// The date is required: default to today so quick creation stays one click.
	// Explicitly chosen (or edited) instead of silently becoming "now" server-side.
	const today = format(new Date(), 'yyyy-MM-dd');

	const handleEnhance = createEnhanceHandler<CreateOrder, void>({
		success: m.dialog_order_add_success(),
		invalidData: m.dialog_order_add_invalid_data(),
		error: m.dialog_order_add_error(),
		onSuccess: () => {
			open = false;
		}
	});
</script>

<Dialog bind:open {triggerClass}>
	{#snippet trigger()}
		{@render children?.()}
	{/snippet}
	{#snippet dialogTitle()}
		{m.dialog_order_add_title()}
	{/snippet}
	{#snippet content()}
		<form {...createOrder.enhance(handleEnhance)} class="space-y-2">
			<label class="label">
				<span class="label-text">{m.form_order_cu_storename_label()}</span>
				<input
					class="input"
					{...createOrder.fields.storeName.as('text')}
					placeholder={m.form_order_cu_storename_placeholder()}
				/>
				{#each createOrder.fields.storeName.issues() as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

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
				<input class="input" {...createOrder.fields.orderDate.as('date', today)} />
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

			<label class="label">
				<span class="label-text">{m.form_order_cu_receipt_label()}</span>
				<input
					class="input"
					{...createOrder.fields.receiptUrl.as('text')}
					placeholder={m.form_order_cu_receipt_placeholder()}
				/>
				{#each createOrder.fields.receiptUrl.issues() as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

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

			<button type="submit" class="preset-filled-gradient-primary-secondary btn w-full">
				{m.dialog_order_add_submit()}
			</button>
		</form>
	{/snippet}
</Dialog>

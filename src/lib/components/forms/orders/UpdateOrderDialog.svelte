<script lang="ts">
	import { Dialog } from '$lib/components/composition';
	import { m } from '$lib/paraglide/messages';
	import { updateOrder } from './updateOrder.remote';
	import { type UpdateOrder } from '$lib/validation/order';
	import { createEnhanceHandler } from '$lib/utils/formUtils';
	import { Portal, Tooltip } from '@skeletonlabs/skeleton-svelte';
	import { Lock } from '@lucide/svelte';
	import CurrencyCodeInput from '$lib/components/CurrencyCodeInput.svelte';
	import FileAttachment from '$lib/components/forms/FileAttachment.svelte';

	type Props = {
		order: UpdateOrder;
		open?: boolean;
		/** Set while the order has books: the currency is locked server-side too. */
		currencyLocked?: boolean;
	};

	let { order, open = $bindable(false), currencyLocked = false }: Props = $props();

	let receiptFileId = $state('');

	const handleEnhance = createEnhanceHandler<UpdateOrder, void>({
		success: m.dialog_order_edit_success(),
		invalidData: m.dialog_order_edit_invalid_data(),
		error: m.dialog_order_edit_error(),
		onSuccess: () => {
			open = false;
		}
	});

	$effect(() => {
		updateOrder.fields.set({
			id: order.id,
			storeName: order.storeName ?? '',
			orderNumber: order.orderNumber ?? '',
			orderDate: order.orderDate ?? '',
			currencyCode: order.currencyCode ?? '',
			receiptUrl: order.receiptUrl ?? '',
			receiptFileId: order.receiptFileId ?? '',
			note: order.note ?? ''
		});
		receiptFileId = order.receiptFileId ?? '';
	});

	$effect(() => {
		updateOrder.fields.receiptFileId.set(receiptFileId);
	});
</script>

<Dialog bind:open size="md">
	{#snippet dialogTitle()}
		{m.dialog_order_edit_title()}
	{/snippet}
	{#snippet content()}
		<form {...updateOrder.enhance(handleEnhance)} class="space-y-2">
			<input {...updateOrder.fields.id.as('hidden', order.id)} />

			<label class="label">
				<span class="label-text">{m.form_order_cu_storename_label()}</span>
				<input
					class="input"
					{...updateOrder.fields.storeName.as('text')}
					placeholder={m.form_order_cu_storename_placeholder()}
				/>
				{#each updateOrder.fields.storeName.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

			<label class="label">
				<span class="label-text">{m.form_order_cu_ordernumber_label()}</span>
				<input
					class="input"
					{...updateOrder.fields.orderNumber.as('text')}
					placeholder={m.form_order_cu_ordernumber_placeholder()}
				/>
				{#each updateOrder.fields.orderNumber.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

			<label class="label">
				<span class="label-text">{m.form_order_cu_orderdate_label()}</span>
				<input class="input" {...updateOrder.fields.orderDate.as('date')} />
				{#each updateOrder.fields.orderDate.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

			<div class={[currencyLocked && 'grid grid-cols-[auto_1fr] gap-2']}>
				{#if currencyLocked}
					<Tooltip>
						<div class="flex flex-col justify-end">
							<Tooltip.Trigger
								type="button"
								class="btn aspect-square preset-tonal"
								aria-label={m.common_currency_locked_aria()}
							>
								<Lock class="size-4" />
							</Tooltip.Trigger>
						</div>
						<Portal>
							<Tooltip.Positioner>
								<Tooltip.Content
									class="z-100 max-w-60 card border border-surface-200-800 preset-filled-surface-50-950 p-2 text-sm shadow-xl"
								>
									{m.form_order_cu_currency_locked_tooltip()}
								</Tooltip.Content>
							</Tooltip.Positioner>
						</Portal>
					</Tooltip>
				{/if}
				<CurrencyCodeInput
					disabled={currencyLocked}
					bind:selected={
						() => updateOrder.fields.currencyCode.value() || null,
						(v) => updateOrder.fields.currencyCode.set(v ?? undefined)
					}
				/>
				<input
					{...updateOrder.fields.currencyCode.as(
						'hidden',
						updateOrder.fields.currencyCode.value() ?? ''
					)}
				/>
				{#each updateOrder.fields.currencyCode.issues() as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</div>

			<label class="label">
				<span class="label-text">{m.form_order_cu_receipt_label()}</span>
				<input
					class="input"
					{...updateOrder.fields.receiptUrl.as('text')}
					placeholder={m.form_order_cu_receipt_placeholder()}
				/>
				{#each updateOrder.fields.receiptUrl.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

			<FileAttachment kind="receipt" bind:value={receiptFileId} />
			<input {...updateOrder.fields.receiptFileId.as('hidden', receiptFileId)} />
			{#each updateOrder.fields.receiptFileId.issues() ?? [] as issue (issue.message)}
				<p class="text-sm text-error-500">{issue.message}</p>
			{/each}

			<label class="label">
				<span class="label-text">{m.form_order_cu_note_label()}</span>
				<input
					class="input"
					{...updateOrder.fields.note.as('text')}
					placeholder={m.form_order_cu_note_placeholder()}
				/>
				{#each updateOrder.fields.note.issues() ?? [] as issue (issue.message)}
					<p class="text-sm text-error-500">{issue.message}</p>
				{/each}
			</label>

			<button type="submit" class="preset-filled-gradient-primary-secondary btn w-full">
				{m.dialog_order_edit_submit()}
			</button>
		</form>
	{/snippet}
</Dialog>

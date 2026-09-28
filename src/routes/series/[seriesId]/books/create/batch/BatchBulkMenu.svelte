<script lang="ts" module>
	export type BulkMenuField =
		'isbn' | 'status' | 'readStatus' | 'currencyCode' | 'paidPrice' | 'originalPrice' | 'boughtAt';

	export type BulkTarget = 'all' | 'selected';
</script>

<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import { m } from '$lib/paraglide/messages';
	import { book } from '$lib/validation';
	import { getBookStatusText, getReadStatusText } from '$lib/components/forms/book';

	type Props = {
		field: BulkMenuField;
		label: string;
		selectedCount: number;
		onapply: (value: string, target: BulkTarget) => void;
	};

	let { field, label, selectedCount, onapply }: Props = $props();

	const statuses = book.bookStatusEnum.options;
	const readStatuses = book.readStatusEnum.options;

	let open = $state(false);
	let value = $state('');
	let valueEl = $state<HTMLInputElement | null>(null);

	const target = $derived<BulkTarget>(selectedCount > 0 ? 'selected' : 'all');

	$effect(() => {
		if (open && valueEl) valueEl.focus();
	});

	function apply(next: string) {
		onapply(field === 'currencyCode' ? next.toUpperCase() : next, target);
		open = false;
	}
</script>

<Menu
	{open}
	positioning={{ placement: 'bottom-start' }}
	onOpenChange={(event) => (open = event.open)}
	onSelect={(event) => apply(event.value)}
>
	<Menu.Trigger
		class="btn btn-icon shrink-0 preset-tonal-surface"
		aria-label={m.book_batch_column_menu()}
		title={m.book_batch_column_menu()}
	>
		<ChevronDown class="size-4" />
	</Menu.Trigger>

	<Portal>
		<Menu.Positioner>
			<Menu.Content
				class="z-50 space-y-1 card border border-surface-300-700 bg-surface-50-950 p-2 shadow-xl"
			>
				<p class="p-2 text-xs font-semibold text-surface-500 uppercase">
					{label}
					· {target === 'selected'
						? m.book_batch_apply_target_selected({ count: selectedCount })
						: m.book_batch_apply_target_all()}
				</p>

				{#if field === 'status'}
					{#each statuses as opt (opt)}
						<Menu.Item
							value={opt}
							class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950"
						>
							<Menu.ItemText>{getBookStatusText(opt)}</Menu.ItemText>
						</Menu.Item>
					{/each}
				{:else if field === 'readStatus'}
					{#each readStatuses as opt (opt)}
						<Menu.Item
							value={opt}
							class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950"
						>
							<Menu.ItemText>{getReadStatusText(opt)}</Menu.ItemText>
						</Menu.Item>
					{/each}
				{:else}
					<div class="field-group grid grid-cols-[1fr_auto]">
						<input
							bind:this={valueEl}
							bind:value
							type={field === 'boughtAt' ? 'month' : 'text'}
							class="input w-full"
							placeholder={m.book_batch_apply_value_placeholder()}
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									apply(value);
								}
							}}
						/>
						<button type="button" class="btn preset-filled" onclick={() => apply(value)}>
							{m.book_batch_apply()}
						</button>
					</div>
				{/if}
			</Menu.Content>
		</Menu.Positioner>
	</Portal>
</Menu>

<script lang="ts" module>
	export type BulkTarget = 'all' | 'selected';
	export type BulkOption = { value: string; label: string };
</script>

<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
	import { m } from '$lib/paraglide/messages';

	type Props = {
		label: string;
		kind: 'text' | 'select' | 'month';
		selectedCount: number;
		options?: BulkOption[];
		onapply: (value: string, target: BulkTarget) => void;
	};

	let { label, kind, selectedCount, options = [], onapply }: Props = $props();

	let open = $state(false);
	let value = $state('');
	let valueEl = $state<HTMLInputElement | null>(null);

	const target = $derived<BulkTarget>(selectedCount > 0 ? 'selected' : 'all');

	$effect(() => {
		if (open && valueEl) valueEl.focus();
	});

	function apply(next: string) {
		onapply(next, target);
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
		aria-label={m.table_column_menu()}
		title={m.table_column_menu()}
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
						? m.table_apply_target_selected({ count: selectedCount })
						: m.table_apply_target_all()}
				</p>

				{#if kind === 'select'}
					{#each options as opt (opt.value)}
						<Menu.Item
							value={opt.value}
							class="flex w-full items-center gap-2 rounded-base p-2 text-left hover:preset-filled-primary-50-950"
						>
							<Menu.ItemText>{opt.label}</Menu.ItemText>
						</Menu.Item>
					{/each}
				{:else}
					<div class="field-group grid grid-cols-[1fr_auto]">
						<input
							bind:this={valueEl}
							bind:value
							type={kind === 'month' ? 'month' : 'text'}
							class="input w-full"
							placeholder={m.table_apply_value_placeholder()}
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									apply(value);
								}
							}}
						/>
						<button type="button" class="btn preset-filled" onclick={() => apply(value)}>
							{m.table_apply()}
						</button>
					</div>
				{/if}
			</Menu.Content>
		</Menu.Positioner>
	</Portal>
</Menu>

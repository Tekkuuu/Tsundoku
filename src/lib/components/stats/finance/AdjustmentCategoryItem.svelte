<script lang="ts">
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { ChevronDown } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages';
	import type { AdjustmentCategory } from './totalSpend.remote';

	interface Props {
		category: AdjustmentCategory;
		sign: 1 | -1;
		formatter: Intl.NumberFormat;
	}

	let { category, sign, formatter }: Props = $props();

	const valueColor = $derived(sign === 1 ? 'text-error-600-400' : 'text-success-600-400');
	const dateFormatter = $derived(
		new Intl.DateTimeFormat(formatter.resolvedOptions().locale, { dateStyle: 'medium' })
	);
</script>

<Accordion.Item value={category.name} class="group rounded-base bg-surface-200-800 text-sm">
	<Accordion.ItemTrigger
		class="flex w-full items-center justify-between gap-2 p-2 text-left group-data-[state=open]:rounded-b-none"
	>
		<span class="flex min-w-0 items-center gap-2">
			<Accordion.ItemIndicator>
				<ChevronDown class="size-4 shrink-0 transition-transform" />
			</Accordion.ItemIndicator>
			<span class="truncate text-surface-600-400">{category.name}</span>
			<span
				class="badge preset-filled-primary-500"
				aria-label={`${category.count} ${m.stats_finance_entries()}`}>{category.count}</span
			>
		</span>
		<span class="shrink-0 text-right font-medium {valueColor}">
			<span>{formatter.format(category.total)}</span>
			<span class="block text-xs font-normal text-surface-500">
				{formatter.format(category.avg)}
				{m.stats_finance_average()}
			</span>
		</span>
	</Accordion.ItemTrigger>
	<Accordion.ItemContent class="border-t border-surface-300-700">
		<ul>
			{#each category.entries as entry (entry.id)}
				<li
					class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 p-1 text-xs text-surface-500"
				>
					<span class="min-w-0 truncate">{entry.storeName ?? m.stats_finance_unavailable()}</span>
					<span>
						{entry.orderDate
							? dateFormatter.format(new Date(entry.orderDate))
							: m.stats_finance_unavailable()}
					</span>
					<span class="font-medium {valueColor}">{formatter.format(entry.amount)}</span>
				</li>
			{/each}
		</ul>
	</Accordion.ItemContent>
</Accordion.Item>

<script lang="ts">
	import {
		Wallet,
		Tags,
		ReceiptText,
		BadgePercent,
		CircleDollarSign,
		RotateCcw
	} from '@lucide/svelte';
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { m } from '$lib/paraglide/messages';
	import { getTotalSpend } from './totalSpend.remote';
	import AdjustmentCategoryItem from './AdjustmentCategoryItem.svelte';
	import { toaster } from '$lib/components/toaster';
	import { createCurrencyFormatter } from '$lib/utils/money';

	let data = $state(getTotalSpend());

	let activeCurrency = $state<string | null>(null);

	$effect(() => {
		const current = data;
		let cancelled = false;
		Promise.resolve(current).catch((value: unknown) => {
			if (cancelled) return;
			console.error('[stats] finance statistics failed', value);
			toaster.error({
				title: m.stats_finance_error(),
				description: value instanceof Error ? value.message : m.stats_finance_error()
			});
		});
		return () => {
			cancelled = true;
		};
	});

	function retry() {
		data = getTotalSpend();
		void data.refresh();
	}
</script>

{#await data}
	<section class="space-y-3 card preset-filled-surface-100-900 p-3" aria-busy="true">
		<div class="flex items-center gap-2">
			<Wallet class="size-4" />
			<div class="skeleton h-5 w-40"></div>
		</div>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:grid-rows-2 xl:grid-cols-5 xl:grid-rows-1">
			{#each [0, 1, 2, 3, 4] as i (i)}
				<div class="space-y-2 rounded-base bg-surface-200-800 p-2 {i === 0 ? 'sm:row-span-2' : ''}">
					<div class="skeleton h-4 w-24"></div>
					<div class="skeleton h-6 w-28"></div>
				</div>
			{/each}
		</div>
	</section>
{:then spend}
	{#if spend.currencies.length === 0}
		<section class="card preset-filled-surface-100-900 p-3">
			<div class="mb-1 flex items-center gap-2">
				<Wallet class="size-4" />
				<h2 class="text-base font-semibold">{m.stats_finance_title()}</h2>
			</div>
			<p class="text-sm text-surface-500">{m.stats_finance_no_data()}</p>
		</section>
	{:else}
		{@const currency =
			spend.currencies.find((c) => c.currency === activeCurrency) ?? spend.currencies[0]}
		{@const formatter = createCurrencyFormatter(currency.currency)}

		{#snippet statCard(Icon: typeof Wallet, label: string, value: number, valueClass: string)}
			<article class="flex flex-col gap-1 rounded-base bg-surface-200-800 p-2">
				<div class="flex items-center gap-2 text-surface-500">
					<Icon class="size-4 shrink-0" />
					<span class="truncate text-xs font-medium">{label}</span>
				</div>
				<p class="text-lg leading-tight font-bold wrap-break-word {valueClass} tabular-nums">
					{formatter.format(value)}
				</p>
			</article>
		{/snippet}

		<section class="card preset-filled-surface-100-900 p-3">
			<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<Wallet class="size-4 shrink-0" />
					<h2 class="truncate text-base font-semibold">{m.stats_finance_title()}</h2>
				</div>
				{#if spend.currencies.length > 1}
					<div
						class="flex flex-wrap gap-1"
						role="tablist"
						aria-label={m.stats_finance_currency_pager()}
					>
						{#each spend.currencies as c (c.currency)}
							<button
								type="button"
								role="tab"
								aria-selected={c.currency === currency.currency}
								class="btn preset-tonal btn-sm {c.currency === currency.currency
									? 'preset-filled-primary-500'
									: ''}"
								onclick={() => (activeCurrency = c.currency)}
							>
								{c.currency}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div
				class="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:grid-rows-2 xl:grid-cols-5 xl:grid-rows-1"
			>
				<article
					class="flex flex-col justify-center gap-1 rounded-base bg-primary-500/10 p-2 ring-1 ring-primary-500/30 sm:row-span-2 xl:row-span-1"
				>
					<div class="flex items-center gap-2 text-primary-700-300">
						<Wallet class="size-4 shrink-0" />
						<span class="truncate text-xs font-medium">{m.stats_finance_total_spent()}</span>
					</div>
					<p class="text-lg leading-tight font-bold wrap-break-word tabular-nums">
						{formatter.format(currency.totalSpent)}
					</p>
				</article>

				{@render statCard(CircleDollarSign, m.stats_finance_book_cost(), currency.totalPaid, '')}
				{@render statCard(Tags, m.stats_finance_original_value(), currency.totalOriginal, '')}
				{@render statCard(
					ReceiptText,
					m.stats_finance_fees(),
					currency.totalFees,
					'text-error-600-400'
				)}
				{@render statCard(
					BadgePercent,
					m.stats_finance_discounts(),
					currency.totalDiscounts,
					'text-success-600-400'
				)}
			</div>

			{#if currency.fees.length > 0 || currency.discounts.length > 0}
				<div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
					<Accordion collapsible class="contents">
						{#if currency.fees.length > 0}
							<section>
								<h3
									class="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-surface-500 uppercase"
								>
									<ReceiptText class="size-4" />
									{m.stats_finance_fees_breakdown()}
								</h3>
								<ul class="space-y-1">
									{#each currency.fees as fee (fee.name)}
										<AdjustmentCategoryItem category={fee} {formatter} sign={1} />
									{/each}
								</ul>
							</section>
						{/if}

						{#if currency.discounts.length > 0}
							<section>
								<h3
									class="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-surface-500 uppercase"
								>
									<BadgePercent class="size-4" />
									{m.stats_finance_discounts_breakdown()}
								</h3>
								<ul class="space-y-1">
									{#each currency.discounts as discount (discount.name)}
										<AdjustmentCategoryItem category={discount} {formatter} sign={-1} />
									{/each}
								</ul>
							</section>
						{/if}
					</Accordion>
				</div>
			{/if}
		</section>
	{/if}
{:catch}
	<section class="card preset-filled-surface-100-900 p-3">
		<div class="mb-1 flex items-center gap-2">
			<Wallet class="size-4" />
			<h2 class="text-base font-semibold">{m.stats_finance_title()}</h2>
		</div>
		<p class="text-sm text-surface-500">{m.stats_finance_error()}</p>
		<button type="button" class="mt-2 btn preset-filled-primary-500 btn-sm" onclick={retry}>
			<RotateCcw class="size-4" />
			{m.stats_finance_retry()}
		</button>
	</section>
{/await}

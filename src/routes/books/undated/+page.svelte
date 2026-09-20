<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft, CalendarX, Search } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages';
	import { createCurrencyFormatter } from '$lib/utils/money';
	import UndatedBookRow from './UndatedBookRow.svelte';

	let { data } = $props();

	let searchQuery = $state('');
	let activeCurrency = $state<string | null>(null);

	const currencies = $derived(
		[...new Set(data.books.map((b) => b.currencyCode).filter((c): c is string => c !== null))].sort(
			(a, b) => a.localeCompare(b)
		)
	);

	const currencyFormats = $derived(
		currencies.map((currency) => ({
			currency,
			formatter: createCurrencyFormatter(currency)
		}))
	);

	function formatPaid(currency: string | null, paid: string | null): string {
		if (paid === null || paid === '') return '—';
		const formatter = currency
			? currencyFormats.find((entry) => entry.currency === currency)?.formatter
			: undefined;
		return formatter?.format(Number(paid)) ?? (currency ? `${paid} ${currency}` : paid);
	}

	const currencyBooks = $derived(
		activeCurrency ? data.books.filter((b) => b.currencyCode === activeCurrency) : data.books
	);

	const totals = $derived.by(() => {
		const entries: { currency: string; count: number; total: number }[] = [];
		for (const b of currencyBooks) {
			// Priceless books have no currency to attribute: visible as rows with
			// '—', excluded from the per-currency money summaries.
			if (!b.currencyCode) continue;
			const entry = entries.find((candidate) => candidate.currency === b.currencyCode);
			if (entry) {
				entry.count += 1;
				entry.total += Number(b.paidPrice);
			} else {
				entries.push({ currency: b.currencyCode, count: 1, total: Number(b.paidPrice) });
			}
		}
		return entries.sort((a, b) => a.currency.localeCompare(b.currency));
	});

	const visibleBooks = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return currencyBooks;
		return currencyBooks.filter(
			(b) => b.seriesTitle.toLowerCase().includes(query) || String(b.volumeNumber).includes(query)
		);
	});
</script>

<main class="mx-auto max-w-6xl min-w-0 p-3 sm:p-4">
	<div class="grid w-full gap-4">
		<header class="flex flex-wrap items-center justify-between gap-2">
			<div class="flex min-w-0 items-center gap-2">
				<CalendarX class="size-5 shrink-0" />
				<h1 class="truncate text-2xl font-bold">{m.books_undated_title()}</h1>
			</div>
			<a href={resolve('/stats')} class="btn preset-tonal btn-sm">
				<ArrowLeft class="size-4" />
				{m.books_undated_back()}
			</a>
		</header>

		<p class="text-sm text-surface-500">{m.books_undated_description()}</p>

		{#if data.books.length === 0}
			<section class="card preset-filled-surface-100-900 p-3">
				<p class="text-sm text-surface-500">{m.books_undated_empty()}</p>
			</section>
		{:else}
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div
					class="flex flex-wrap gap-1"
					role="tablist"
					aria-label={m.books_undated_currency_filter()}
				>
					<button
						type="button"
						role="tab"
						aria-selected={activeCurrency === null}
						class="btn btn-sm {activeCurrency === null
							? 'preset-filled-primary-500'
							: 'preset-tonal'}"
						onclick={() => (activeCurrency = null)}
					>
						{m.books_undated_all()}
					</button>
					{#each currencies as currency (currency)}
						<button
							type="button"
							role="tab"
							aria-selected={activeCurrency === currency}
							class="btn btn-sm {activeCurrency === currency
								? 'preset-filled-primary-500'
								: 'preset-tonal'}"
							onclick={() => (activeCurrency = currency)}
						>
							{currency}
						</button>
					{/each}
				</div>
				<div class="relative">
					<Search class="absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-60" />
					<input
						type="search"
						bind:value={searchQuery}
						placeholder={m.books_undated_search_placeholder()}
						class="input pl-7"
					/>
				</div>
			</div>

			<div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-surface-500">
				{#each totals as summary (summary.currency)}
					<span class="tabular-nums">
						{summary.count} · {formatPaid(summary.currency, String(summary.total))}
					</span>
				{/each}
			</div>

			{#if visibleBooks.length === 0}
				<section class="card preset-filled-surface-100-900 p-3">
					<p class="text-sm text-surface-500">{m.books_undated_no_results()}</p>
				</section>
			{:else}
				<section class="card preset-filled-surface-100-900 p-3">
					<div class="overflow-x-auto">
						<table class="table text-sm tabular-nums [&_td]:px-2 [&_td]:py-1">
							<thead>
								<tr>
									<th class="text-left whitespace-nowrap">{m.books_undated_series()}</th>
									<th class="text-right whitespace-nowrap">{m.books_undated_volume()}</th>
									<th class="text-right whitespace-nowrap">{m.books_undated_paid()}</th>
									<th class="text-left whitespace-nowrap">{m.books_undated_bought_at()}</th>
									<th><span class="sr-only">{m.books_undated_actions()}</span></th>
								</tr>
							</thead>
							<tbody>
								{#each visibleBooks as row (row.id)}
									<UndatedBookRow {row} {formatPaid} />
								{/each}
							</tbody>
						</table>
					</div>
				</section>
			{/if}
		{/if}
	</div>
</main>

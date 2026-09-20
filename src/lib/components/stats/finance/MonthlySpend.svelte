<script lang="ts">
	import { CalendarRange, CalendarX, ChartColumnBig, ChevronDown, RotateCcw } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { Accordion } from '@skeletonlabs/skeleton-svelte';
	import { BarChart, Tooltip } from 'layerchart';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { getMonthlySpend, type MonthlyBucket } from './monthlySpend.remote';
	import { toaster } from '$lib/components/toaster';
	import { createCurrencyFormatter } from '$lib/utils/money';
	import MonthInput from '$lib/components/MonthInput.svelte';

	const BOOKS_COLOR = 'var(--color-primary-500)';
	const FEES_COLOR = 'var(--color-error-500)';
	const SAVINGS_COLOR = 'var(--color-success-500)';

	let data = $state(getMonthlySpend());

	let activeCurrency = $state<string | null>(null);

	$effect(() => {
		const current = data;
		let cancelled = false;
		Promise.resolve(current).catch((value: unknown) => {
			if (cancelled) return;
			console.error('[stats] monthly finance statistics failed', value);
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
		data = getMonthlySpend();
		void data.refresh();
	}

	type LabeledBucket = MonthlyBucket & { monthLabel: string };

	type RangePreset = '3m' | '6m' | '12m' | 'ytd' | 'all' | 'custom';

	const RANGE_PRESETS: RangePreset[] = ['3m', '6m', '12m', 'ytd', 'all', 'custom'];

	const PRESET_MONTHS: Partial<Record<RangePreset, number>> = {
		'3m': 3,
		'6m': 6,
		'12m': 12
	};

	let rangePreset = $state<RangePreset>('all');
	let customStart = $state('');
	let customEnd = $state('');

	function presetLabel(preset: RangePreset): string {
		switch (preset) {
			case 'ytd':
				return m.stats_monthly_range_this_year();
			case 'all':
				return m.stats_monthly_range_all();
			case 'custom':
				return m.stats_monthly_range_custom();
			default:
				return preset.toUpperCase();
		}
	}

	function shiftMonthKey(key: string, delta: number): string {
		if (!key) return '';
		const [year, month] = key.split('-').map(Number);
		const date = new Date(year, month - 1 + delta, 1);
		if (Number.isNaN(date.getTime())) return '';
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
	}

	function resolveRange(
		preset: RangePreset,
		start: string,
		end: string,
		dataStart: string,
		dataEnd: string
	): [string, string] {
		if (preset === 'custom') {
			let from = start || dataStart;
			let to = end || dataEnd;
			if (from && to && from > to) [from, to] = [to, from];
			return [from, to];
		}
		if (preset === 'all') return [dataStart, dataEnd];
		if (preset === 'ytd') {
			const year = new Date().getFullYear();
			return [`${year}-01`, `${year}-12`];
		}
		return [shiftMonthKey(dataEnd, -(PRESET_MONTHS[preset] ?? 12) + 1), dataEnd];
	}

	const shortMonthFormatter = new Intl.DateTimeFormat(getLocale(), { month: 'short' });

	// '2026-01' -> 'Jan'
	function shortMonth(month: string): string {
		const [year, monthIndex] = month.split('-').map(Number);
		return shortMonthFormatter.format(new Date(year, monthIndex - 1, 1));
	}

	// '2026-01' -> 'Jan 26'
	function monthLabel(month: string): string {
		const [year] = month.split('-').map(Number);
		return `${shortMonth(month)} ${String(year).slice(2)}`;
	}

	type YearGroup = {
		year: string;
		label: string;
		total: number;
		rows: LabeledBucket[];
	};

	function groupBucketsByYear(rows: LabeledBucket[]): YearGroup[] {
		const groups: YearGroup[] = [];
		for (let index = rows.length - 1; index >= 0; index--) {
			const row = rows[index];
			const year = row.month.slice(0, 4);
			let group = groups.find((candidate) => candidate.year === year);
			if (!group) {
				group = { year, label: year, total: 0, rows: [] };
				groups.push(group);
			}
			group.rows.push(row);
			group.total += row.total;
		}
		for (const group of groups) {
			const newest = shortMonth(group.rows[0].month);
			const oldest = shortMonth(group.rows[group.rows.length - 1].month);
			group.label =
				newest === oldest ? `${newest} ${group.year}` : `${oldest}–${newest} ${group.year}`;
		}
		return groups;
	}
</script>

{#snippet bucketTable(rows: LabeledBucket[], formatter: Intl.NumberFormat)}
	<table class="table text-sm tabular-nums [&_td]:px-2 [&_td]:py-1">
		<thead>
			<tr>
				<th class="text-left whitespace-nowrap">{m.stats_monthly_month()}</th>
				<th class="text-right whitespace-nowrap">{m.stats_monthly_book_cost()}</th>
				<th class="text-right whitespace-nowrap">{m.stats_monthly_fees()}</th>
				<th class="text-right whitespace-nowrap">{m.stats_monthly_discounts()}</th>
				<th class="text-right whitespace-nowrap">{m.stats_monthly_total()}</th>
				<th class="text-right whitespace-nowrap">{m.stats_monthly_orders()}</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as bucket (bucket.month)}
				<tr>
					<td class="font-medium whitespace-nowrap">{bucket.monthLabel}</td>
					<td class="text-right whitespace-nowrap">{formatter.format(bucket.bookCost)}</td>
					<td class="text-right whitespace-nowrap">{formatter.format(bucket.fees)}</td>
					<td class="text-right whitespace-nowrap text-success-600-400">
						{formatter.format(bucket.discounts)}
					</td>
					<td class="text-right font-semibold whitespace-nowrap">
						{formatter.format(bucket.total)}
					</td>
					<td class="text-right whitespace-nowrap text-surface-500">
						{bucket.orderCount}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/snippet}

{#await data}
	<section class="space-y-3 card preset-filled-surface-100-900 p-3" aria-busy="true">
		<div class="flex items-center gap-2">
			<ChartColumnBig class="size-4" />
			<div class="skeleton h-5 w-48"></div>
		</div>
		<div class="skeleton h-56 w-full"></div>
	</section>
{:then spend}
	{#if spend.currencies.length === 0}
		<section class="card preset-filled-surface-100-900 p-3">
			<div class="mb-1 flex items-center gap-2">
				<ChartColumnBig class="size-4" />
				<h2 class="text-base font-semibold">{m.stats_monthly_title()}</h2>
			</div>
			<p class="text-sm text-surface-500">{m.stats_monthly_no_data()}</p>
		</section>
	{:else}
		{@const currency =
			spend.currencies.find((c) => c.currency === activeCurrency) ?? spend.currencies[0]}
		{@const formatter = createCurrencyFormatter(currency.currency)}
		{@const buckets = currency.buckets}
		{@const unknown = currency.unknown}

		<section class="card preset-filled-surface-100-900 p-3">
			<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
				<div class="flex min-w-0 items-center gap-2">
					<ChartColumnBig class="size-4 shrink-0" />
					<h2 class="truncate text-base font-semibold">{m.stats_monthly_title()}</h2>
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

			{#if buckets.length > 0}
				{@const dataStartKey = buckets[0].month}
				{@const dataEndKey = buckets[buckets.length - 1].month}
				{@const [startKey, endKey] = resolveRange(
					rangePreset,
					customStart,
					customEnd,
					dataStartKey,
					dataEndKey
				)}
				{@const visibleBuckets = buckets
					.filter((b) => b.month >= startKey && b.month <= endKey)
					.map((b) => ({ ...b, monthLabel: monthLabel(b.month) }))}

				<div class="mb-2 flex flex-wrap gap-1">
					{#each RANGE_PRESETS as preset (preset)}
						<button
							type="button"
							aria-pressed={rangePreset === preset}
							class="btn btn-sm {rangePreset === preset
								? 'preset-filled-primary-500'
								: 'preset-tonal'}"
							onclick={() => {
								rangePreset = preset;
								if (preset === 'custom') {
									if (!customStart) customStart = dataStartKey;
									if (!customEnd) customEnd = dataEndKey;
								}
							}}
						>
							{presetLabel(preset)}
						</button>
					{/each}
				</div>

				{#if rangePreset === 'custom'}
					<div class="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
						<label class="label">
							<span class="label-text">{m.stats_monthly_range_from()}</span>
							<MonthInput bind:value={customStart} id="monthly-range-start" />
						</label>
						<label class="label">
							<span class="label-text">{m.stats_monthly_range_to()}</span>
							<MonthInput bind:value={customEnd} id="monthly-range-end" />
						</label>
					</div>
				{/if}

				{#if visibleBuckets.length > 0}
					{@const netTotal = visibleBuckets.reduce((sum, b) => sum + b.total, 0)}
					{@const booksTotal = visibleBuckets.reduce((sum, b) => sum + b.bookCost, 0)}
					{@const feesTotal = visibleBuckets.reduce((sum, b) => sum + b.fees, 0)}
					{@const savingsTotal = visibleBuckets.reduce((sum, b) => sum + Math.abs(b.discounts), 0)}
					{@const monthCount = visibleBuckets.length}
					{@const range =
						monthCount > 1
							? `${visibleBuckets[0].monthLabel} – ${visibleBuckets[monthCount - 1].monthLabel}`
							: visibleBuckets[0].monthLabel}

					<div class="mb-2 grid auto-rows-fr grid-cols-2 gap-2 lg:grid-cols-4">
						<article
							class="flex min-w-0 flex-col gap-1 rounded-lg bg-primary-500/10 p-2 ring-1 ring-primary-500/30"
						>
							<span class="truncate text-xs font-medium text-primary-700-300"
								>{m.stats_monthly_avg_title()}</span
							>
							<p class="text-lg leading-tight font-bold wrap-break-word tabular-nums">
								{formatter.format(netTotal / monthCount)}
							</p>
							<span class="truncate text-xs leading-tight text-surface-500">{range}</span>
						</article>
						<article class="flex min-w-0 flex-col gap-1 rounded-lg bg-surface-200-800 p-2">
							<span class="truncate text-xs font-medium text-surface-500"
								>{m.stats_monthly_avg_books()}</span
							>
							<p class="text-lg leading-tight font-bold wrap-break-word tabular-nums">
								{formatter.format(booksTotal / monthCount)}
							</p>
						</article>
						<article class="flex min-w-0 flex-col gap-1 rounded-lg bg-surface-200-800 p-2">
							<span class="truncate text-xs font-medium text-surface-500"
								>{m.stats_monthly_avg_fees()}</span
							>
							<p
								class="text-lg leading-tight font-bold wrap-break-word text-error-600-400 tabular-nums"
							>
								{formatter.format(feesTotal / monthCount)}
							</p>
						</article>
						<article class="flex min-w-0 flex-col gap-1 rounded-lg bg-surface-200-800 p-2">
							<span class="truncate text-xs font-medium text-surface-500"
								>{m.stats_monthly_avg_savings()}</span
							>
							<p
								class="text-lg leading-tight font-bold wrap-break-word text-success-600-400 tabular-nums"
							>
								{formatter.format(savingsTotal / monthCount)}
							</p>
						</article>
					</div>

					<div class="overflow-x-auto">
						<div class="min-w-135">
							<BarChart
								data={visibleBuckets}
								x="monthLabel"
								y="total"
								height={240}
								props={{ xAxis: { ticks: 12 } }}
							>
								{#snippet tooltip()}
									<Tooltip.Root>
										{#snippet children({ data: tooltipData })}
											{@const row = tooltipData as LabeledBucket}
											<Tooltip.Header
												>{row.monthLabel} · {formatter.format(row.total)}</Tooltip.Header
											>
											<Tooltip.List>
												<Tooltip.Item
													label={m.stats_monthly_book_cost()}
													value={formatter.format(row.bookCost)}
													color={BOOKS_COLOR}
													valueAlign="right"
												/>
												<Tooltip.Item
													label={m.stats_monthly_fees()}
													value={formatter.format(row.fees)}
													color={FEES_COLOR}
													valueAlign="right"
												/>
												<Tooltip.Item
													label={m.stats_monthly_savings()}
													value={formatter.format(Math.abs(row.discounts))}
													color={SAVINGS_COLOR}
													valueAlign="right"
												/>
												<Tooltip.Separator />
												<Tooltip.Item
													label={m.stats_monthly_orders()}
													value={row.orderCount}
													valueAlign="right"
												/>
											</Tooltip.List>
										{/snippet}
									</Tooltip.Root>
								{/snippet}
							</BarChart>
						</div>
					</div>

					<div class="mt-3">
						<h3
							class="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-surface-500 uppercase"
						>
							<CalendarRange class="size-4" />
							{m.stats_monthly_breakdown()}
						</h3>
						{#if visibleBuckets.length > 12}
							{@const groups = groupBucketsByYear(visibleBuckets)}
							{#key `${currency.currency}:${startKey}:${endKey}`}
								<Accordion defaultValue={[groups[0].year]} collapsible class="space-y-2">
									{#each groups as group (group.year)}
										<Accordion.Item value={group.year} class="rounded-lg bg-surface-200-800">
											<Accordion.ItemTrigger
												class="flex w-full items-center justify-between gap-2 p-2 text-left"
											>
												<span class="min-w-0 truncate font-medium">{group.label}</span>
												<span class="flex shrink-0 items-center gap-2">
													<span class="font-semibold tabular-nums"
														>{formatter.format(group.total)}</span
													>
													<Accordion.ItemIndicator>
														<ChevronDown class="size-4 shrink-0" />
													</Accordion.ItemIndicator>
												</span>
											</Accordion.ItemTrigger>
											<Accordion.ItemContent
												class="overflow-x-auto border-t border-surface-300-700"
											>
												{@render bucketTable(group.rows, formatter)}
											</Accordion.ItemContent>
										</Accordion.Item>
									{/each}
								</Accordion>
							{/key}
						{:else}
							<div class="overflow-x-auto">
								{@render bucketTable([...visibleBuckets].reverse(), formatter)}
							</div>
						{/if}
					</div>
				{:else}
					<p class="mt-3 text-sm text-surface-500">{m.stats_monthly_no_range_data()}</p>
				{/if}
			{:else}
				<div class="flex h-60 items-center justify-center rounded-lg bg-surface-200-800">
					<p class="text-sm text-surface-500">{m.stats_monthly_no_data()}</p>
				</div>
			{/if}

			{#if unknown.bookCount > 0}
				<div class="mt-3">
					<h3
						class="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-surface-500 uppercase"
					>
						<CalendarX class="size-4" />
						{m.stats_monthly_unknown_title()}
					</h3>
					<div
						class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface-200-800 p-2"
					>
						<p class="text-lg leading-tight font-bold wrap-break-word tabular-nums">
							{formatter.format(unknown.bookCost)}
						</p>
						<span class="text-xs wrap-break-word text-surface-500"
							>{unknown.bookCount} {m.stats_monthly_unknown_books()}</span
						>
						<a href={resolve('/books/undated')} class="ml-auto btn preset-tonal btn-sm">
							{m.stats_monthly_unknown_view_list()}
						</a>
					</div>
				</div>
			{/if}
		</section>
	{/if}
{:catch}
	<section class="card preset-filled-surface-100-900 p-3">
		<div class="mb-1 flex items-center gap-2">
			<ChartColumnBig class="size-4" />
			<h2 class="text-base font-semibold">{m.stats_monthly_title()}</h2>
		</div>
		<p class="text-sm text-surface-500">{m.stats_finance_error()}</p>
		<button type="button" class="mt-2 btn preset-filled-primary-500 btn-sm" onclick={retry}>
			<RotateCcw class="size-4" />
			{m.stats_finance_retry()}
		</button>
	</section>
{/await}

<script lang="ts">
	import { BarChart, Labels, defaultChartPadding } from 'layerchart';
	import { getSeriesGenreStats } from '#lib/remote/genre.remote.js';
	import { m } from '#lib/paraglide/messages.js';
	import { ChevronDown } from '@lucide/svelte';

	type BarRow = { name: string; seriesCount: number };

	let data = $state(getSeriesGenreStats());
	const stats = $derived(data.current);

	let viewportWidth = $state(1280);

	/** Top genres by series count. */
	function topRows(genres: { name: string; seriesCount: number }[]): BarRow[] {
		return [...genres]
			.sort((a, b) => b.seriesCount - a.seriesCount)
			.slice(0, topN)
			.map((genre) => ({
				name: genre.name,
				seriesCount: genre.seriesCount
			}));
	}

	const rows = $derived(stats ? topRows(stats.genres) : []);
	let rowHeight = $state(24);

	let expand = $state(false);
	let topN = $derived(expand ? stats?.genres.length || 8 : 8);
</script>

<svelte:window bind:innerWidth={viewportWidth} />

<div class="w-full card preset-filled-surface-100-900 p-3">
	<div class="mb-2 flex justify-between">
		<h2 class="text-lg font-bold">{m.stats_genre_top()}</h2>
		<button
			type="button"
			class="btn aspect-square preset-tonal btn-xs"
			onclick={() => {
				expand = !expand;
			}}
		>
			<ChevronDown
				class="size-4 transition-all duration-150 {expand ? 'rotate-180' : 'rotate-0'}"
			/>
		</button>
	</div>
	{#if stats}
		{#if rows.length === 0}
			<p class="py-4 text-center text-sm opacity-70">{m.genre_admin_empty()}</p>
		{:else}
			<div class="overflow-x-auto">
				<BarChart
					data={rows}
					y="name"
					x="seriesCount"
					axis="x"
					orientation="horizontal"
					height={Math.max(140, rows.length * rowHeight + 48)}
					padding={defaultChartPadding({ left: 16, right: 32 })}
					bandPadding={0.2}
					series={[{ key: 'seriesCount', color: 'var(--color-primary-500)' }]}
				>
					{#snippet aboveMarks()}
						<Labels
							x={() => 0}
							value="name"
							class="pointer-events-none stroke-none text-sm font-medium text-primary-contrast-500"
						></Labels>
					{/snippet}
				</BarChart>
			</div>
		{/if}
	{:else if data.error}
		<p class="py-4 text-center text-sm opacity-70">{m.error_description()}</p>
	{:else}
		<div class="h-48 animate-pulse rounded-lg bg-surface-200-800" aria-hidden="true"></div>
	{/if}
</div>

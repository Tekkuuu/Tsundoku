<script lang="ts">
	import { Tabs } from '@skeletonlabs/skeleton-svelte';
	import { m } from '#lib/paraglide/messages.js';
	import TotalSpend from '#lib/components/stats/finance/TotalSpend.svelte';
	import MonthlySpend from '#lib/components/stats/finance/MonthlySpend.svelte';
	import MissingSeriesVolumes from '#lib/components/stats/series/MissingSeriesVolumes.svelte';
	import GenreTopBars from '#lib/components/stats/series/GenreTopBars.svelte';
	import { snapshot } from '$app/navigation';

	let currentTab = $state('finance');

	snapshot({
		capture: () => currentTab,
		restore: (v) => (currentTab = v)
	});
</script>

<main class="container min-w-0 p-3 sm:p-4">
	<div class="grid w-full gap-4">
		<header>
			<h1 class="text-2xl font-bold">{m.stats_title()}</h1>
		</header>

		<Tabs
			defaultValue="finance"
			onValueChange={(e) => {
				currentTab = e.value;
			}}
			value={currentTab}
		>
			<Tabs.List>
				<Tabs.Trigger value="finance">{m.stats_tab_finance()}</Tabs.Trigger>
				<Tabs.Trigger value="series">{m.stats_tab_series()}</Tabs.Trigger>
				<Tabs.Indicator />
			</Tabs.List>
			<Tabs.Content value="finance" class="mt-4">
				<div class="grid gap-4 *:min-w-0">
					<TotalSpend />
					<MonthlySpend />
				</div>
			</Tabs.Content>
			<Tabs.Content value="series" class="mt-4">
				<div class="grid gap-4 *:min-w-0">
					<MissingSeriesVolumes />
					<GenreTopBars />
				</div>
			</Tabs.Content>
		</Tabs>
	</div>
</main>

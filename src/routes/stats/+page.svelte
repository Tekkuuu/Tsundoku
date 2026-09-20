<script lang="ts">
	import { Tabs } from '@skeletonlabs/skeleton-svelte';
	import { m } from '$lib/paraglide/messages';
	import TotalSpend from '$lib/components/stats/finance/TotalSpend.svelte';
	import MonthlySpend from '$lib/components/stats/finance/MonthlySpend.svelte';
</script>

<main class="mx-auto max-w-6xl min-w-0 p-3 sm:p-4">
	<div class="grid w-full gap-4">
		<header>
			<h1 class="text-2xl font-bold">{m.stats_title()}</h1>
		</header>

		<Tabs defaultValue="finance">
			<Tabs.List class="tabs-list">
				<Tabs.Trigger value="finance" class="tabs-trigger">
					{m.stats_tab_finance()}
				</Tabs.Trigger>
			</Tabs.List>
			<Tabs.Content value="finance" class="mt-4">
				<div class="grid gap-4 *:min-w-0">
					<TotalSpend />
					<MonthlySpend />
				</div>
			</Tabs.Content>
		</Tabs>
	</div>
</main>

<script lang="ts">
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import { Settings } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages';
</script>

<svelte:head>
	<title>{m.settings_title()}</title>
</svelte:head>

<main class="p-4">
	<div class="mx-auto max-w-2xl space-y-4">
		<div class="flex items-center gap-2">
			<Settings class="size-6" />
			<h1 class="text-2xl font-bold">{m.settings_title()}</h1>
		</div>

		<section class="space-y-4 card preset-filled-surface-100-900 p-6">
			<div>
				<h2 class="text-lg font-semibold">{m.settings_language()}</h2>
				<p class="text-sm opacity-70">{m.settings_language_description()}</p>
			</div>
			<LocaleSwitcher />
		</section>
	</div>
</main>

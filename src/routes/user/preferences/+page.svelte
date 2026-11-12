<script lang="ts">
	import { Brush } from '@lucide/svelte';
	import LocaleSwitcher from '#lib/components/ui/LocaleSwitcher.svelte';
	import ThemeSelector from '#lib/components/ui/ThemeSelector.svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.preferences_title()}</title>
</svelte:head>

<main class="container p-4">
	<div class="mx-auto max-w-2xl space-y-4">
		<div class="flex items-center gap-2">
			<Brush class="size-6" />
			<h1 class="text-2xl font-bold">{m.preferences_title()}</h1>
		</div>

		<section class="space-y-4 card preset-filled-surface-100-900 p-6">
			<div>
				<h2 class="text-lg font-semibold">{m.preferences_language()}</h2>
				<p class="text-sm opacity-70">{m.preferences_language_description()}</p>
			</div>
			<LocaleSwitcher />
		</section>

		<section class="space-y-4 card preset-filled-surface-100-900 p-6">
			<div>
				<h2 class="text-lg font-semibold">{m.preferences_theme()}</h2>
				<p class="text-sm opacity-70">{m.preferences_theme_description()}</p>
			</div>
			<ThemeSelector />
		</section>
	</div>
</main>

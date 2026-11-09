<script lang="ts">
	import { resolve } from '$app/paths';
	import LocaleSwitcher from '#lib/components/ui/LocaleSwitcher.svelte';
	import { Settings, Tags } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<svelte:head>
	<title>{m.settings_title()}</title>
</svelte:head>

<main class="container p-4">
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

		<section class="space-y-4 card preset-filled-surface-100-900 p-6">
			<div>
				<h2 class="text-lg font-semibold">{m.genre_admin_title()}</h2>
				<p class="text-sm opacity-70">{m.genre_admin_description()}</p>
			</div>
			<a href={resolve('series/genres')} class="btn w-fit preset-tonal">
				<Tags class="size-4" />
				{m.genre_admin_title()}
			</a>
		</section>
	</div>
</main>

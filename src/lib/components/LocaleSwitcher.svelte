<script lang="ts">
	import { getLocale, setLocale, locales, type Locale } from '$lib/paraglide/runtime';
	import { Check, Languages } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages';

	const labels: Record<Locale, string> = {
		en: 'English',
		pl: 'Polski'
	};

	let current = $state<Locale>(getLocale());

	function change(newLocale: Locale) {
		if (newLocale === current) return;
		setLocale(newLocale);
	}
</script>

<div class="flex items-center gap-2" role="group" aria-label={m.settings_language()}>
	<Languages class="size-4 opacity-70" />
	{#each locales as locale (locale)}
		<button
			type="button"
			class="btn px-3 {locale === current ? 'preset-filled-primary-500' : 'preset-tonal'}"
			aria-pressed={locale === current}
			onclick={() => change(locale)}
		>
			{#if locale === current}
				<Check class="size-4" />
			{/if}
			{labels[locale] ?? locale}
		</button>
	{/each}
</div>

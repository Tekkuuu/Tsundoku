<script lang="ts">
	import { persistedStorage } from '#lib/client/persisted-storage.svelte.js';
	import { m } from '#lib/paraglide/messages.js';
	import { SegmentedControl } from '@skeletonlabs/skeleton-svelte';
	import _ from 'lodash';

	const THEMES = ['omm', 'cerberus'];

	let mode = persistedStorage<string>('mode', 'system');
	let theme = persistedStorage<string>('theme', 'omm');

	function handleThemeModeChange(m: string) {
		mode.value = m;
		document.documentElement.setAttribute('data-mode', mode.value);
	}

	function handleThemeChange(t: string) {
		theme.value = t;
		document.documentElement.setAttribute('data-theme', theme.value);
	}
</script>

<div class="flex flex-col gap-2" role="group" aria-label={m.preferences_theme()}>
	<SegmentedControl
		value={mode.value}
		onValueChange={(details) => handleThemeModeChange(details.value || 'system')}
	>
		<SegmentedControl.Control>
			<SegmentedControl.Indicator />
			<SegmentedControl.Item value="light">
				<SegmentedControl.ItemText>{m.preferences_theme_light()}</SegmentedControl.ItemText>
				<SegmentedControl.ItemHiddenInput />
			</SegmentedControl.Item>
			<SegmentedControl.Item value="dark">
				<SegmentedControl.ItemText>{m.preferences_theme_dark()}</SegmentedControl.ItemText>
				<SegmentedControl.ItemHiddenInput />
			</SegmentedControl.Item>
			<SegmentedControl.Item value="system">
				<SegmentedControl.ItemText>{m.preferences_theme_system()}</SegmentedControl.ItemText>
				<SegmentedControl.ItemHiddenInput />
			</SegmentedControl.Item>
		</SegmentedControl.Control>
	</SegmentedControl>
	<select
		class="select"
		bind:value={theme.value}
		onchange={(e) => {
			handleThemeChange(e.currentTarget.value || 'omm');
		}}
	>
		{#each THEMES as t}
			<option value={t}>{_.capitalize(t)}</option>
		{/each}
	</select>
</div>

<script lang="ts">
	import { ImageOff } from '@lucide/svelte';

	type Props = {
		src?: string | null;
		alt: string;
		imgClass?: string;
		fallbackClass?: string;
		label?: string;
		eager?: boolean;
	};

	let { src, alt, imgClass = '', fallbackClass = '', label, eager = false }: Props = $props();

	let failedSrc: string | null = $state(null);
	const showFallback = $derived(!src || failedSrc === src);
</script>

{#if showFallback}
	<div
		class="flex flex-col items-center justify-center gap-1 bg-surface-200-800 {fallbackClass}"
		role="img"
		aria-label={alt}
	>
		<ImageOff class="size-5 opacity-50" />
		{#if label}
			<span class="text-xs opacity-60">{label}</span>
		{/if}
	</div>
{:else}
	<img
		{src}
		{alt}
		class={imgClass}
		loading={eager ? 'eager' : 'lazy'}
		onerror={() => (failedSrc = src ?? null)}
	/>
{/if}

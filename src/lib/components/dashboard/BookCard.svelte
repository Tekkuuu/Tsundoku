<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowUpRight, type LucideIcon } from '@lucide/svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	import { m } from '$lib/paraglide/messages';

	type Props = {
		seriesId: string;
		bookId: string;
		title: string;
		volumeNumber: number;
		src?: string | null;
		alt: string;
		noCoverLabel: string;
		openLabel: string;
		primaryAction?: {
			label: string;
			icon: LucideIcon;
			onclick: () => void;
		};
	};

	let {
		seriesId,
		bookId,
		title,
		volumeNumber,
		src,
		alt,
		noCoverLabel,
		openLabel,
		primaryAction
	}: Props = $props();

	const href = $derived(resolve(`/series/${seriesId}/${bookId}`));
</script>

<article class="mx-auto flex h-full w-full min-w-48 gap-2 card preset-filled-surface-50-950 p-2">
	<a {href} class="block">
		<BookCover
			{src}
			{alt}
			imgClass="h-24 aspect-2/3 max-w-full rounded object-cover"
			fallbackClass="h-24 aspect-2/3 max-w-full rounded"
			label={noCoverLabel}
		/>
	</a>
	<div class="flex min-w-0 flex-col gap-2">
		<div class="min-w-0">
			<a {href} class="hover:underline">
				<p class="truncate font-medium">{title}</p>
			</a>
			<p class="text-sm text-surface-500">
				{m.dashboard_widget_reading_volume({ volumeNumber })}
			</p>
		</div>
		<div class="mt-auto flex w-fit gap-2">
			{#if primaryAction}
				{@const PrimaryIcon = primaryAction.icon}
				<button
					type="button"
					class="btn preset-filled-success-500 p-2"
					title={primaryAction.label}
					aria-label={primaryAction.label}
					onclick={primaryAction.onclick}
				>
					<PrimaryIcon class="size-4" />
				</button>
			{/if}
			<a {href} class="btn preset-filled-primary-500 p-2" title={openLabel} aria-label={openLabel}>
				<ArrowUpRight class="size-4" />
			</a>
		</div>
	</div>
</article>

<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import BookCover from '$lib/components/BookCover.svelte';
	import { getReading } from '$lib/components/forms/book/getReading.remote';
	import { markOwned } from '$lib/components/forms/book/markOwned.remote';
	import { markRead } from '$lib/components/forms/book/markRead.remote';
	import InfoDialog from '$lib/components/InfoDialog.svelte';
	import { coverSrc } from '$lib/fileUrl';
	import { m } from '$lib/paraglide/messages';
	import { createRemoteActionHandler } from '$lib/utils/formUtils';
	import {
		type Icon,
		ArrowUpRight,
		BookCheck,
		BookOpen,
		PackageCheck,
		ShoppingBag,
		Library,
		BookHeart,
		Package,
		Book
	} from '@lucide/svelte';
	import type { PageProps } from './$types';
	import { Marquee } from '@skeletonlabs/skeleton-svelte';

	let { data }: PageProps = $props();

	const kpiMarquee = $derived([
		{ label: m.dashboard_kpimarquee_series(), icon: Library, stat: data.kpi.series.count },
		{ label: m.dashboard_kpimarquee_ownedvolumes(), icon: Book, stat: data.kpi.volumes.countOwned },
		{
			label: m.dashboard_kpimarquee_readvolumes(),
			icon: BookCheck,
			stat: data.kpi.volumes.countRead
		},
		{
			label: m.dashboard_kpimarquee_orderedvolumes(),
			icon: PackageCheck,
			stat: data.kpi.volumes.countOrdered
		},
		{
			label: m.dashboard_kpimarquee_wishlistedvolumes(),
			icon: BookHeart,
			stat: data.kpi.volumes.countWishlisted
		},
		{ label: m.dashboard_kpimarquee_orders(), icon: Package, stat: data.kpi.orders.count }
	]);

	const radius = 52;
	const circumference = 2 * Math.PI * radius;

	const progress = $derived(
		data.kpi.volumes.countOwned && data.kpi.volumes.countOwned > 0
			? Math.min(1, (data.kpi.volumes.countRead ?? 0) / data.kpi.volumes.countOwned)
			: 0
	);
	const percentage = $derived(Math.round(progress * 100));
	const offset = $derived(circumference * (1 - progress));

	const reading = getReading();
	let pendingOwnedBookId = $state<string | null>(null);

	function requiresOwnedConfirmation(item: (typeof data.ordered)[number]) {
		return !item.inOrder && (!item.book.boughtAt || item.book.paidPrice === null);
	}

	function confirmMarkOwned() {
		if (pendingOwnedBookId === null) return;

		const bookId = pendingOwnedBookId;
		pendingOwnedBookId = null;
		void createRemoteActionHandler({
			success: m.dashboard_widget_ordered_success_bookowned(),
			error: m.dashboard_widget_ordered_error_bookowned(),
			run: () => markOwned({ id: bookId, status: 'Owned' }),
			onSuccess: () => invalidateAll()
		})();
	}
</script>

<main class="mx-auto max-w-6xl">
	<Marquee autoFill pauseOnInteraction class="p-2">
		<Marquee.Edge side="start" />
		<Marquee.Viewport>
			<Marquee.Context>
				{#snippet children(marquee)}
					{#each Array.from({ length: marquee().contentCount }) as _, index}
						<Marquee.Content {index}>
							{#each kpiMarquee as item}
								{@const KPIIcon = item.icon}
								<div class="flex items-center gap-2 card bg-surface-100-900 p-2 whitespace-nowrap">
									<span><KPIIcon /></span>
									<span>{item.label}</span>
									<span class="font-medium text-primary-500">{item.stat}</span>
								</div>
							{/each}
						</Marquee.Content>
					{/each}
				{/snippet}
			</Marquee.Context>
		</Marquee.Viewport>
		<Marquee.Edge side="end" />
	</Marquee>

	<div class="mx-auto grid max-w-7xl grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
		<section
			class="flex flex-col items-center justify-center gap-4 card preset-filled-surface-100-900 p-6"
		>
			<h2 class="text-xl font-semibold">{m.dashboard_widget_readprogress()}</h2>
			{#if data.kpi.volumes.countOwned != undefined && data.kpi.volumes.countRead != undefined}
				<div class="relative">
					<svg class="size-40 -rotate-90" viewBox="0 0 120 120">
						<circle
							class="text-surface-200-800"
							cx="60"
							cy="60"
							r={radius}
							fill="none"
							stroke="currentColor"
							stroke-width="10"
						/>
						<circle
							class="text-primary-500"
							cx="60"
							cy="60"
							r={radius}
							fill="none"
							stroke="currentColor"
							stroke-width="10"
							stroke-linecap="round"
							stroke-dasharray={circumference}
							stroke-dashoffset={offset}
						/>
					</svg>
					<div class="absolute inset-0 flex flex-col items-center justify-center">
						<span class="text-3xl font-bold">{percentage}%</span>
						<span class="text-surface-500-500 text-xs">
							{data.kpi.volumes.countRead} / {data.kpi.volumes.countOwned}
						</span>
					</div>
				</div>
			{:else}
				<p class="text-error-500">{m.dashboard_error_occurred()}</p>
			{/if}
		</section>

		<section class="card preset-filled-surface-100-900 p-4">
			<div class="mb-4 flex items-center gap-2">
				<BookOpen class="size-5" />
				<h2 class="text-xl font-semibold">{m.dashboard_widget_reading_title()}</h2>
			</div>
			{#await reading then books}
				{#if books.length > 0}
					<ul class="space-y-3">
						{#each books as item (item.book.id)}
							{@const onMarkRead = createRemoteActionHandler({
								success: m.dashboard_widget_reading_success_bookcomplted(),
								error: m.dashboard_widget_reading_error_bookcomplted(),
								run: () => markRead({ id: item.book.id, readStatus: 'Completed' }),
								onSuccess: () => reading.refresh()
							})}
							<li class="flex items-center gap-3">
								<a href={resolve(`/series/${item.series.id}/${item.book.id}`)} class="shrink-0">
									<BookCover
										src={coverSrc(item.book)}
										alt={m.dashboard_cover_alt({ title: item.series.title })}
										imgClass="h-24 w-16 rounded object-cover"
										fallbackClass="h-24 w-16 rounded"
										label={m.dashboard_widget_reading_nocover()}
									/>
								</a>
								<div class="min-w-0 flex-1">
									<a
										href={resolve(`/series/${item.series.id}/${item.book.id}`)}
										class="hover:underline"
									>
										<p class="truncate font-medium">{item.series.title}</p>
									</a>
									<p class="text-surface-500-500 text-sm">
										{m.dashboard_widget_reading_volume({ volumeNumber: item.book.volumeNumber })}
									</p>
								</div>
								<div class="flex gap-1">
									<button
										type="button"
										class="btn preset-filled-success-500 p-2"
										title={m.dashboard_widget_reading_markcompleted()}
										onclick={onMarkRead}
									>
										<BookCheck class="size-4" />
									</button>
									<a
										href={resolve(`/series/${item.series.id}/${item.book.id}`)}
										class="btn preset-filled-primary-500 p-2"
										title={m.dashboard_widget_reading_openbook()}
									>
										<ArrowUpRight class="size-4" />
									</a>
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-surface-500-500 text-sm">{m.dashboard_widget_reading_empty()}</p>
				{/if}
			{/await}
		</section>

		<section class="card preset-filled-surface-100-900 p-4 md:col-span-2 lg:col-span-1">
			<div class="mb-4 flex items-center gap-2">
				<ShoppingBag class="size-5" />
				<h2 class="text-xl font-semibold">{m.dashboard_widget_ordered_title()}</h2>
			</div>
			{#if data.ordered.length > 0}
				<ul class="space-y-3">
					{#each data.ordered as item (item.book.id)}
						{@const onMarkOwned = createRemoteActionHandler({
							success: m.dashboard_widget_ordered_success_bookowned(),
							error: m.dashboard_widget_ordered_error_bookowned(),
							run: () => markOwned({ id: item.book.id, status: 'Owned' }),
							onSuccess: () => invalidateAll()
						})}
						{@const handleMarkOwned = () => {
							if (requiresOwnedConfirmation(item)) {
								pendingOwnedBookId = item.book.id;
								return;
							}
							onMarkOwned();
						}}
						<li class="flex items-center gap-3">
							<a href={resolve(`/series/${item.series.id}/${item.book.id}`)} class="shrink-0">
								<BookCover
									src={coverSrc(item.book)}
									alt={m.dashboard_cover_alt({ title: item.series.title })}
									imgClass="h-24 w-16 rounded object-cover"
									fallbackClass="h-24 w-16 rounded"
									label={m.dashboard_widget_reading_nocover()}
								/>
							</a>
							<div class="min-w-0 flex-1">
								<a
									href={resolve(`/series/${item.series.id}/${item.book.id}`)}
									class="hover:underline"
								>
									<p class="truncate font-medium">{item.series.title}</p>
								</a>
								<p class="text-surface-500-500 text-sm">
									{m.dashboard_widget_reading_volume({ volumeNumber: item.book.volumeNumber })}
								</p>
							</div>
							<div class="flex gap-1">
								<button
									type="button"
									class="btn preset-filled-success-500 p-2"
									title={m.dashboard_widget_ordered_markowned()}
									onclick={handleMarkOwned}
								>
									<PackageCheck class="size-4" />
								</button>
								<a
									href={resolve(`/series/${item.series.id}/${item.book.id}`)}
									class="btn preset-filled-primary-500 p-2"
									title={m.dashboard_widget_reading_openbook()}
								>
									<ArrowUpRight class="size-4" />
								</a>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-surface-500-500 text-sm">{m.dashboard_widget_ordered_empty()}</p>
			{/if}
		</section>
	</div>
	<InfoDialog
		open={pendingOwnedBookId !== null}
		title={m.dashboard_widget_ordered_incomplete_title()}
		message={m.dashboard_widget_ordered_incomplete_message()}
		confirmLabel={m.dashboard_widget_ordered_incomplete_confirm()}
		onOpenChange={(event) => {
			if (!event.open) pendingOwnedBookId = null;
		}}
		onConfirm={confirmMarkOwned}
	/>
</main>

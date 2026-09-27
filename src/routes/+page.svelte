<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import BookCard from '$lib/components/dashboard/BookCard.svelte';
	import { getReading } from '$lib/components/forms/book/getReading.remote';
	import { markOwned } from '$lib/components/forms/book/markOwned.remote';
	import { markRead } from '$lib/components/forms/book/markRead.remote';
	import { updateBookReadStatus } from '$lib/components/forms/book/updateBookReadStatus.remote';
	import InfoDialog from '$lib/components/InfoDialog.svelte';
	import { coverSrc } from '$lib/fileUrl';
	import { m } from '$lib/paraglide/messages';
	import { createRemoteActionHandler } from '$lib/utils/formUtils';
	import {
		Book,
		BookCheck,
		BookHeart,
		BookMarked,
		BookOpen,
		ChevronLeft,
		ChevronRight,
		Library,
		Package,
		PackageCheck,
		Play,
		ShoppingBag
	} from '@lucide/svelte';
	import { Carousel, Marquee, Progress } from '@skeletonlabs/skeleton-svelte';
	import type { PageProps } from './$types';
	import { MediaQuery } from 'svelte/reactivity';

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

	const ownedCount = $derived(data.kpi.volumes.countOwned ?? 0);
	const readCount = $derived(data.kpi.volumes.countRead ?? 0);
	const percentage = $derived(ownedCount > 0 ? Math.round((readCount / ownedCount) * 100) : 0);

	const reading = getReading();
	let pendingOwnedBookId = $state<string | null>(null);

	const perPage = (count: number) => {
		if (lgMedia.current) {
			return count < 4 ? count : 4;
		} else if (mdMedia.current) {
			return count < 3 ? count : 3;
		} else if (smMedia.current) {
			return count < 2 ? count : 2;
		} else {
			return 1;
		}
	};

	const lgMedia = new MediaQuery('min-width: 64rem');
	const mdMedia = new MediaQuery('min-width: 48rem');
	const smMedia = new MediaQuery('min-width: 40rem');

	type ToReadItem = (typeof data.unread)[number];

	let toReadQuery = $state('');
	const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

	function compareToRead(a: ToReadItem, b: ToReadItem) {
		const byTitle = collator.compare(a.series.title, b.series.title);
		const byVolume = a.book.volumeNumber - b.book.volumeNumber;

		return byTitle || byVolume;
	}

	const toRead = $derived.by(() => {
		const query = toReadQuery.trim().toLocaleLowerCase();
		const items = query
			? data.unread.filter(
					(item) =>
						item.series.title.toLocaleLowerCase().includes(query) ||
						(item.series.author ?? '').toLocaleLowerCase().includes(query)
				)
			: data.unread;
		return items.toSorted((a, b) => compareToRead(a, b));
	});

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

	function advanceBook(run: () => Promise<unknown>, opts: { success: string; error: string }) {
		return createRemoteActionHandler({
			...opts,
			run,
			onSuccess: async () => {
				await invalidateAll();
				await reading.refresh();
			}
		});
	}
</script>

<main class="mx-auto max-w-6xl space-y-2 p-2">
	<Marquee autoFill pauseOnInteraction>
		<Marquee.Edge side="start" />
		<Marquee.Viewport>
			<Marquee.Context>
				{#snippet children(marquee)}
					{#each [...Array(marquee().contentCount).keys()] as index (index)}
						<Marquee.Content {index}>
							{#each kpiMarquee as item (item.label)}
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

	<!-- Reading progress -->
	<section class="space-y-2 card preset-filled-surface-100-900 p-2">
		<div class="flex items-center gap-2">
			<BookCheck class="size-5" />
			<h2 class="text-xl font-semibold">{m.dashboard_widget_readprogress()}</h2>
		</div>
		<Progress value={percentage}>
			<div class="flex items-baseline justify-between gap-2">
				<Progress.Label class="text-sm text-surface-500">
					{m.dashboard_widget_readprogress_label({ read: readCount, owned: ownedCount })}
				</Progress.Label>
				<span class="text-lg font-bold tabular-nums">{percentage}%</span>
			</div>
			<Progress.Track>
				<Progress.Range class="bg-primary-500" />
			</Progress.Track>
		</Progress>
	</section>

	<!-- Currently reading -->
	<section class="space-y-2 card preset-filled-surface-100-900 p-2">
		<div class="flex items-center gap-2">
			<BookOpen class="size-5" />
			<h2 class="text-xl font-semibold">{m.dashboard_widget_reading_title()}</h2>
		</div>
		{#await reading then books}
			{#if books.length > 0}
				<Carousel
					slideCount={books.length}
					slidesPerPage={perPage(books.length)}
					spacing=".25rem"
					padding="1rem"
					loop
				>
					<div class="relative">
						<Carousel.Control>
							<Carousel.PrevTrigger
								class="absolute top-1/2 left-0 z-10 btn -translate-y-1/2 rounded-full preset-filled-primary-500 p-2"
							>
								<ChevronLeft class="size-4" />
							</Carousel.PrevTrigger>
							<Carousel.NextTrigger
								class="absolute top-1/2 right-0 z-10 btn -translate-y-1/2 rounded-full preset-filled-primary-500 p-2"
							>
								<ChevronRight class="size-4" />
							</Carousel.NextTrigger>
						</Carousel.Control>
						<Carousel.ItemGroup>
							{#each books as item, index (item.book.id)}
								{@const onMarkRead = advanceBook(
									() => markRead({ id: item.book.id, readStatus: 'Completed' }),
									{
										success: m.dashboard_widget_reading_success_bookcomplted(),
										error: m.dashboard_widget_reading_error_bookcomplted()
									}
								)}
								<Carousel.Item {index} class="h-full">
									<BookCard
										seriesId={item.series.id}
										bookId={item.book.id}
										title={item.series.title}
										volumeNumber={item.book.volumeNumber}
										src={coverSrc(item.book)}
										alt={m.dashboard_cover_alt({ title: item.series.title })}
										noCoverLabel={m.dashboard_widget_reading_nocover()}
										openLabel={m.dashboard_widget_reading_openbook()}
										primaryAction={{
											label: m.dashboard_widget_reading_markcompleted(),
											icon: BookCheck,
											onclick: onMarkRead
										}}
									/>
								</Carousel.Item>
							{/each}
						</Carousel.ItemGroup>
					</div>
					<Carousel.Context>
						{#snippet children(carousel)}
							<div class="mt-2 flex items-center justify-center font-medium">
								<span>
									{m.dashboard_widget_carousel_page({
										page: carousel().page + 1,
										totalPages: carousel().pageSnapPoints.length
									})}
								</span>
							</div>
						{/snippet}
					</Carousel.Context>
				</Carousel>
			{:else}
				<p class="text-sm text-surface-500">{m.dashboard_widget_reading_empty()}</p>
			{/if}
		{/await}
	</section>

	<!-- Ordered -->
	<section class="space-y-2 card preset-filled-surface-100-900 p-2">
		<div class="flex items-center gap-2">
			<ShoppingBag class="size-5" />
			<h2 class="text-xl font-semibold">{m.dashboard_widget_ordered_title()}</h2>
		</div>
		{#if data.ordered.length > 0}
			<Carousel
				slideCount={data.ordered.length}
				slidesPerPage={perPage(data.ordered.length)}
				spacing=".25rem"
				padding="1rem"
				loop
			>
				<div class="relative">
					<Carousel.Control>
						<Carousel.PrevTrigger
							class="absolute top-1/2 left-0 z-10 btn -translate-y-1/2 rounded-full preset-filled-primary-500 p-2"
						>
							<ChevronLeft class="size-4" />
						</Carousel.PrevTrigger>
						<Carousel.NextTrigger
							class="absolute top-1/2 right-0 z-10 btn -translate-y-1/2 rounded-full preset-filled-primary-500 p-2"
						>
							<ChevronRight class="size-4" />
						</Carousel.NextTrigger>
					</Carousel.Control>
					<Carousel.ItemGroup>
						{#each data.ordered as item, index (item.book.id)}
							{@const onMarkOwned = advanceBook(
								() => markOwned({ id: item.book.id, status: 'Owned' }),
								{
									success: m.dashboard_widget_ordered_success_bookowned(),
									error: m.dashboard_widget_ordered_error_bookowned()
								}
							)}
							{@const handleMarkOwned = () => {
								if (requiresOwnedConfirmation(item)) {
									pendingOwnedBookId = item.book.id;
									return;
								}
								onMarkOwned();
							}}
							<Carousel.Item {index} class="h-full">
								<BookCard
									seriesId={item.series.id}
									bookId={item.book.id}
									title={item.series.title}
									volumeNumber={item.book.volumeNumber}
									src={coverSrc(item.book)}
									alt={m.dashboard_cover_alt({ title: item.series.title })}
									noCoverLabel={m.dashboard_widget_reading_nocover()}
									openLabel={m.dashboard_widget_reading_openbook()}
									primaryAction={{
										label: m.dashboard_widget_ordered_markowned(),
										icon: PackageCheck,
										onclick: handleMarkOwned
									}}
								/>
							</Carousel.Item>
						{/each}
					</Carousel.ItemGroup>
				</div>
				<Carousel.Context>
					{#snippet children(carousel)}
						<div class="mt-2 flex items-center justify-center font-medium">
							<span>
								{m.dashboard_widget_carousel_page({
									page: carousel().page + 1,
									totalPages: carousel().pageSnapPoints.length
								})}
							</span>
						</div>
					{/snippet}
				</Carousel.Context>
			</Carousel>
		{:else}
			<p class="text-sm text-surface-500">{m.dashboard_widget_ordered_empty()}</p>
		{/if}
	</section>

	<!-- To read -->
	<section class="space-y-2 card preset-filled-surface-100-900 p-2">
		<div class="flex items-center gap-2">
			<BookMarked class="size-5" />
			<h2 class="text-xl font-semibold">{m.dashboard_widget_toread_title()}</h2>
			{#if data.unread.length > 0}
				<span class="text-sm text-surface-500">({data.unread.length})</span>
			{/if}
		</div>
		{#if data.unread.length > 0}
			<div class="flex items-center">
				<input
					type="search"
					class="input"
					placeholder={m.dashboard_widget_toread_search()}
					aria-label={m.dashboard_widget_toread_search()}
					bind:value={toReadQuery}
				/>
			</div>
		{/if}
		{#if data.unread.length === 0}
			<p class="text-sm text-surface-500">{m.dashboard_widget_toread_empty()}</p>
		{:else if toRead.length === 0}
			<p class="text-sm text-surface-500">{m.dashboard_widget_toread_noresults()}</p>
		{:else}
			<Carousel
				slideCount={toRead.length}
				slidesPerPage={perPage(toRead.length)}
				spacing=".25rem"
				padding="1rem"
				loop
			>
				<div class="relative">
					<Carousel.Control>
						<Carousel.PrevTrigger
							class="absolute top-1/2 left-0 z-10 btn -translate-y-1/2 rounded-full preset-filled-primary-500 p-2"
						>
							<ChevronLeft class="size-4" />
						</Carousel.PrevTrigger>
						<Carousel.NextTrigger
							class="absolute top-1/2 right-0 z-10 btn -translate-y-1/2 rounded-full preset-filled-primary-500 p-2"
						>
							<ChevronRight class="size-4" />
						</Carousel.NextTrigger>
					</Carousel.Control>
					<Carousel.ItemGroup>
						{#each toRead as item, index (item.book.id)}
							{@const onStartReading = advanceBook(
								() => updateBookReadStatus({ id: item.book.id, readStatus: 'Reading' }),
								{
									success: m.dashboard_widget_toread_success_started(),
									error: m.dashboard_widget_toread_error_started()
								}
							)}
							<Carousel.Item {index} class="h-full">
								<BookCard
									seriesId={item.series.id}
									bookId={item.book.id}
									title={item.series.title}
									volumeNumber={item.book.volumeNumber}
									src={coverSrc(item.book)}
									alt={m.dashboard_cover_alt({ title: item.series.title })}
									noCoverLabel={m.dashboard_widget_reading_nocover()}
									openLabel={m.dashboard_widget_reading_openbook()}
									primaryAction={{
										label: m.dashboard_widget_toread_startreading(),
										icon: Play,
										onclick: onStartReading
									}}
								/>
							</Carousel.Item>
						{/each}
					</Carousel.ItemGroup>
				</div>
				<Carousel.Context>
					{#snippet children(carousel)}
						<div class="mt-2 flex items-center justify-center font-medium">
							<span>
								{m.dashboard_widget_carousel_page({
									page: carousel().page + 1,
									totalPages: carousel().pageSnapPoints.length
								})}
							</span>
						</div>
					{/snippet}
				</Carousel.Context>
			</Carousel>
		{/if}
	</section>

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

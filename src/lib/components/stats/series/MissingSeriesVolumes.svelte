<script lang="ts">
	import { BookCheck, BookBookmark, RotateCcw } from '@lucide/svelte';
	import BookCover from '#lib/components/book/BookCover.svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { getAllMissingSeriesVolumes } from '#lib/remote/series.remote.js';
	import { coverSrc } from '#lib/shared/file-url.js';

	type MissingVolumeGroup =
		| { kind: 'single'; value: number }
		| { kind: 'range'; from: number; to: number };

	const MAX_EXPLICIT_RUN = 3;

	function groupMissingVolumes(volumes: number[]): MissingVolumeGroup[] {
		const groups: MissingVolumeGroup[] = [];
		let start: number | undefined;
		let previous: number | undefined;

		function pushRun() {
			if (start === undefined || previous === undefined) return;

			if (previous - start + 1 <= MAX_EXPLICIT_RUN) {
				for (let value = start; value <= previous; value++) {
					groups.push({ kind: 'single', value });
				}
			} else {
				groups.push({ kind: 'range', from: start, to: previous });
			}

			start = undefined;
			previous = undefined;
		}

		for (const value of volumes) {
			if (previous !== undefined && value === previous + 1) {
				previous = value;
				continue;
			}

			pushRun();
			start = value;
			previous = value;
		}

		pushRun();
		return groups;
	}

	let data = $state(getAllMissingSeriesVolumes());

	function reload() {
		data = getAllMissingSeriesVolumes();
	}
</script>

{#snippet seriesCard(
	seriesId: string,
	seriesTitle: string,
	latestCoverId: string,
	missing: number[]
)}
	{@const missingGroups = groupMissingVolumes(missing)}

	<a
		href={`/series/${seriesId}`}
		class="group relative flex flex-col rounded-base transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
		aria-label={m.stats_missing_open_series({ title: seriesTitle })}
	>
		<BookCover
			src={latestCoverId !== '' ? coverSrc({ coverFileId: latestCoverId }) : null}
			alt={m.series_cover_alt({ title: seriesTitle })}
			label={seriesTitle}
			imgClass="aspect-2/3 w-full rounded object-cover shadow-md transition-shadow duration-200 group-hover:shadow-xl"
			fallbackClass="aspect-2/3 w-full rounded shadow-md transition-shadow duration-200 group-hover:shadow-xl"
		/>
		<div
			class="pointer-events-none absolute inset-0 flex flex-col justify-end rounded-base bg-linear-to-t from-surface-950/95 via-surface-950/70 to-transparent"
		>
			<div class="p-2">
				<span class="line-clamp-2 font-bold text-surface-50 group-hover:underline">
					{seriesTitle}
				</span>
				<ul class="mt-2 flex flex-wrap gap-1" aria-label={m.stats_missing_title()}>
					{#each missingGroups as group (group.kind === 'single' ? group.value : `${group.from}-${group.to}`)}
						<li
							class="flex h-8 min-w-8 items-center justify-center rounded-base preset-filled-error-500 px-1.5 font-semibold tabular-nums"
							aria-label={group.kind === 'single'
								? m.stats_missing_volume_aria({ volumeNumber: group.value })
								: m.stats_missing_volume_range_aria({ from: group.from, to: group.to })}
						>
							<span aria-hidden="true">
								{group.kind === 'single' ? group.value : `${group.from}-${group.to}`}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</a>
{/snippet}

<div class="w-full card preset-filled-surface-100-900 p-3">
	<div class="mb-2 flex items-center gap-2">
		<BookBookmark class="size-4" />
		<h2 class="text-base font-semibold">{m.stats_missing_title()}</h2>
	</div>

	{#await data}
		<div
			class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
			aria-busy="true"
			aria-label={m.stats_missing_loading()}
		>
			{#each Array(6) as _, index (index)}
				<div class="skeleton aspect-2/3 w-full rounded-base"></div>
			{/each}
		</div>
	{:then entry}
		{#if entry.length === 0}
			<div
				class="flex h-48 flex-col items-center justify-center gap-2 rounded-lg bg-surface-200-800 p-4 text-center"
			>
				<BookCheck class="size-8 text-success-500" />
				<p class="text-sm text-surface-500">{m.stats_missing_empty()}</p>
			</div>
		{:else}
			{@const sorted = [...entry].sort(
				(a, b) => b.missing.length - a.missing.length || a.seriesTitle.localeCompare(b.seriesTitle)
			)}

			<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
				{#each sorted as series (series.seriesId)}
					{@render seriesCard(
						series.seriesId,
						series.seriesTitle,
						series.latestCoverId,
						series.missing
					)}
				{/each}
			</div>
		{/if}
	{:catch}
		<div>
			<p class="text-sm text-surface-500">{m.stats_missing_error()}</p>
			<button type="button" class="mt-2 btn preset-filled-primary-500 btn-sm" onclick={reload}>
				<RotateCcw class="size-4" />
				{m.stats_missing_retry()}
			</button>
		</div>
	{/await}
</div>

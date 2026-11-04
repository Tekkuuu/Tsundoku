<script lang="ts">
	import { Plus, SquareArrowOutUpRight, X } from '@lucide/svelte';
	import { Popover } from '@skeletonlabs/skeleton-svelte';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import type {
		CalendarCompletedRead,
		CalendarPlannedRead
	} from '#lib/remote/reading-plan.remote.js';
	import { entryLabel } from './calendar-labels';

	type Props = {
		selectedDate: Date;
		completed: CalendarCompletedRead[];
		planned: CalendarPlannedRead[];
		dateFormatter: Intl.DateTimeFormat;
		onRemove: (item: CalendarPlannedRead) => void;
		onSchedule: () => void;
	};

	let { selectedDate, completed, planned, dateFormatter, onRemove, onSchedule }: Props = $props();
</script>

<div class="space-y-2">
	<header class="flex items-start justify-between gap-2">
		<p class="text-sm font-semibold">{dateFormatter.format(selectedDate)}</p>
		<Popover.CloseTrigger
			class="btn-icon hover:preset-tonal"
			aria-label={m.dashboard_calendar_close_day()}
			title={m.dashboard_calendar_close_day()}
		>
			<X class="size-4" />
		</Popover.CloseTrigger>
	</header>

	<div class="max-h-72 space-y-2 overflow-y-auto">
		{#if completed.length > 0}
			<section class="flex flex-col gap-1">
				<p class="text-sm font-semibold text-surface-800-200 uppercase">
					{m.dashboard_calendar_completed()}
				</p>
				{#each completed as read (read.bookId)}
					<a
						href={resolve(`series/${read.seriesId}/${read.bookId}`)}
						class="btn flex items-center justify-between preset-filled-primary-500"
					>
						<span class="truncate">{entryLabel(read)}</span>
						<SquareArrowOutUpRight class="size-4" />
					</a>
				{/each}
			</section>
		{/if}

		{#if planned.length > 0}
			<section class="flex flex-col gap-1">
				<p class="text-sm font-semibold text-surface-800-200 uppercase">
					{m.dashboard_calendar_planned()}
				</p>
				{#each planned as item (item.id)}
					<div class="flex items-center gap-1">
						<a
							href={resolve(`series/${item.seriesId}/${item.bookId}`)}
							class="btn flex items-center justify-between preset-filled-primary-500"
						>
							<span class="truncate">{entryLabel(item)}</span>
							<SquareArrowOutUpRight class="size-4" />
						</a>
						<button
							type="button"
							class="btn flex items-center justify-between preset-filled-primary-500"
							aria-label={m.dashboard_calendar_unschedule()}
							title={m.dashboard_calendar_unschedule()}
							onclick={() => onRemove(item)}
						>
							<X class="size-4" />
						</button>
					</div>
				{/each}
			</section>
		{/if}

		{#if completed.length === 0 && planned.length === 0}
			<p class="text-sm text-surface-800-200">
				{m.dashboard_calendar_empty_day()}
			</p>
		{/if}
	</div>

	<button
		type="button"
		class="btn w-full justify-center preset-filled-primary-500 btn-sm"
		onclick={onSchedule}
	>
		<Plus class="size-4" />
		{m.dashboard_calendar_schedule()}
	</button>
</div>

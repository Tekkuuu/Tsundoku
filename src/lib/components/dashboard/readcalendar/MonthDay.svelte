<script lang="ts">
	import { format, isToday } from 'date-fns';
	import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
	import type {
		CalendarCompletedRead,
		CalendarPlannedRead
	} from '#lib/remote/reading-plan.remote.js';
	import DayDetails from './DayDetails.svelte';
	import { dayAriaLabel } from './calendar-labels';
	import { markerClass, type DayMarkerKind } from './calendar-utils';

	type Props = {
		day: Date;
		currentMonth: boolean;
		selected: boolean;
		open: boolean;
		completed: CalendarCompletedRead[];
		planned: CalendarPlannedRead[];
		dateFormatter: Intl.DateTimeFormat;
		onOpenChange: (open: boolean) => void;
		onRemove: (item: CalendarPlannedRead) => void;
		onSchedule: () => void;
	};

	let {
		day,
		currentMonth,
		selected,
		open,
		completed,
		planned,
		dateFormatter,
		onOpenChange,
		onRemove,
		onSchedule
	}: Props = $props();

	const MAX_VISIBLE_MARKERS = 4;

	const markers = $derived([
		...completed.map((entry) => ({ kind: 'completed' as const, entry })),
		...planned.map((entry) => ({ kind: 'planned' as const, entry }))
	]);

	function monthDayClass(day: Date, selected: boolean, currentMonth: boolean): string {
		const base =
			'relative flex h-28 w-full min-h-0 flex-col items-start p-2 text-left transition-colors focus-visible:z-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 sm:h-10 sm:flex-row sm:items-center sm:justify-between';

		if (selected) {
			return `${base} border-primary-500 bg-primary-500 text-primary-contrast-500 hover:bg-primary-600`;
		}
		if (!currentMonth) {
			return `${base} bg-surface-50-950/50 text-surface-500 hover:bg-primary-50-950/75 hover:opacity-100`;
		}
		if (isToday(day)) {
			return `${base} bg-primary-500/50 hover:bg-primary-500/75`;
		}
		return `${base} bg-surface-50-950 hover:border-primary-500 hover:bg-primary-500/50`;
	}

	function countBadgeClass(kind: DayMarkerKind, selected: boolean): string {
		const base =
			'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums';

		if (kind === 'completed') {
			return `${base} ${
				selected
					? 'bg-primary-contrast-500 text-primary-500'
					: 'bg-primary-500 text-primary-contrast-500'
			}`;
		}

		return `${base} ${
			selected
				? 'border border-primary-contrast-500 text-primary-contrast-500'
				: 'border border-primary-500 text-primary-500'
		}`;
	}
</script>

{#snippet ping(kind: DayMarkerKind)}
	<span class="size-1.5 rounded-full {markerClass(kind, selected)}" aria-hidden="true"></span>
{/snippet}

{#snippet countBadges()}
	{#if completed.length > 0}
		<span class={countBadgeClass('completed', selected)} aria-hidden="true">
			{completed.length}
		</span>
	{/if}
	{#if planned.length > 0}
		<span class={countBadgeClass('planned', selected)} aria-hidden="true">
			{planned.length}
		</span>
	{/if}
{/snippet}

<Popover {open} onOpenChange={(details) => onOpenChange(details.open)}>
	<Popover.Trigger
		type="button"
		class={monthDayClass(day, selected, currentMonth)}
		aria-label={dayAriaLabel(day, completed, planned, dateFormatter)}
	>
		<span class="text-sm tabular-nums">{format(day, 'd')}</span>
		{#if markers.length > 0}
			<span class="mt-auto flex w-full flex-col items-center gap-1 sm:hidden">
				<!-- Mobile: one ping, otherwise vertical count badges -->
				{#if markers.length > 1}
					{@render countBadges()}
				{:else}
					{@render ping(markers[0].kind)}
				{/if}
			</span>
			<span class="mt-auto ml-auto hidden items-center gap-1 sm:mt-0 sm:flex">
				<!-- Desktop: pings up to the limit, otherwise horizontal count badges -->
				{#if markers.length > MAX_VISIBLE_MARKERS}
					{@render countBadges()}
				{:else}
					{#each markers as marker (marker.kind + marker.entry.bookId)}
						{@render ping(marker.kind)}
					{/each}
				{/if}
			</span>
		{/if}
	</Popover.Trigger>

	<Portal>
		<Popover.Positioner class="z-50">
			<Popover.Content class="max-w-[calc(100vw-2rem)] card bg-surface-200-800 p-3 shadow-xl">
				<Popover.Arrow
					class="[--arrow-background:var(--color-surface-200-800)] [--arrow-size:--spacing(2)]"
				>
					<Popover.ArrowTip />
				</Popover.Arrow>
				<DayDetails
					selectedDate={day}
					{completed}
					{planned}
					{dateFormatter}
					{onRemove}
					{onSchedule}
				/>
			</Popover.Content>
		</Popover.Positioner>
	</Portal>
</Popover>

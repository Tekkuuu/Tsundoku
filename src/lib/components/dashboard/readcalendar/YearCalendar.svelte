<script lang="ts">
	import { addDays, isSameDay, startOfWeek } from 'date-fns';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import type {
		CalendarCompletedRead,
		CalendarPlannedRead
	} from '#lib/remote/reading-plan.remote.js';
	import HeatmapDay from './HeatmapDay.svelte';
	import {
		dateKey,
		heatColor,
		heatmapCornerClasses,
		type HeatmapCorner,
		type WeekDay
	} from './calendar-utils';

	type MonthHeatmap = {
		month: number;
		label: string;
		days: (Date | null)[];
	};

	type Props = {
		year: number;
		weekDays: WeekDay[];
		selectedDate: Date | null;
		openDayKey: string | null;
		completedByDay: Record<string, CalendarCompletedRead[]>;
		plannedByDay: Record<string, CalendarPlannedRead[]>;
		dateFormatter: Intl.DateTimeFormat;
		onOpenChange: (day: Date, open: boolean) => void;
		onRemove: (item: CalendarPlannedRead) => void;
		onSchedule: () => void;
	};

	let {
		year,
		weekDays,
		selectedDate,
		openDayKey,
		completedByDay,
		plannedByDay,
		dateFormatter,
		onOpenChange,
		onRemove,
		onSchedule
	}: Props = $props();

	const locale = getLocale();
	const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long' });

	const months = $derived(
		Array.from({ length: 12 }, (_, month): MonthHeatmap => {
			const first = new Date(year, month, 1);
			const start = startOfWeek(first, { weekStartsOn: 1 });
			const days = Array.from({ length: 42 }, (_, index) => {
				const day = addDays(start, index);
				return day.getMonth() === month ? day : null;
			});

			return {
				month,
				label: monthFormatter.format(first),
				days
			};
		})
	);

	const totalCompleted = $derived.by(() => {
		let total = 0;
		for (const month of months) {
			for (const day of month.days) {
				if (day) total += completedByDay[dateKey(day)]?.length ?? 0;
			}
		}
		return total;
	});

	function isSelected(day: Date): boolean {
		return selectedDate != null && isSameDay(day, selectedDate);
	}

	function weekdayInitial(weekDay: WeekDay): string {
		return weekDay.short.charAt(0).toLocaleUpperCase(locale);
	}

	function cornersFor(index: number): HeatmapCorner[] {
		if (index === 0) return ['tl'];
		if (index === 6) return ['tr'];
		if (index === 35) return ['bl'];
		if (index === 41) return ['br'];
		return [];
	}
</script>

<div
	class="mx-auto grid w-full max-w-272 justify-center gap-4"
	style="--heat-cell: 2.125rem; grid-template-columns: repeat(auto-fit, calc(7 * var(--heat-cell) + 6 * 1px + 1rem))"
>
	{#each months as month (month.month)}
		<div class="w-full rounded-base p-2">
			<p class="text-center text-base font-semibold capitalize">
				{month.label}
			</p>

			<div class="mb-px grid gap-px" style="grid-template-columns: repeat(7, 1fr)">
				{#each weekDays as weekDay, index (index)}
					<span
						class="flex aspect-square items-center justify-center text-center text-sm text-surface-700-300"
						title={weekDay.long}
					>
						<span>{weekdayInitial(weekDay)}</span>
					</span>
				{/each}
			</div>

			<div class="grid gap-px" style="grid-template-columns: repeat(7, 1fr)">
				{#each month.days as day, index (index)}
					{#if day}
						<HeatmapDay
							{day}
							corners={cornersFor(index)}
							selected={isSelected(day)}
							open={openDayKey === dateKey(day)}
							completed={completedByDay[dateKey(day)] ?? []}
							planned={plannedByDay[dateKey(day)] ?? []}
							{dateFormatter}
							onOpenChange={(open) => onOpenChange(day, open)}
							{onRemove}
							{onSchedule}
						/>
					{:else}
						<span
							class="aspect-square bg-surface-50-950/50 {heatmapCornerClasses(cornersFor(index))}"
						></span>
					{/if}
				{/each}
			</div>
		</div>
	{/each}
</div>

<div
	class="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-surface-700-300"
>
	<span>
		{m.dashboard_calendar_year_summary({ completed: totalCompleted })}
	</span>
	<span class="flex items-center gap-1">
		{m.dashboard_calendar_heatmap_less()}
		<span class="size-3 rounded-xs" style="background-color: {heatColor(0)}"></span>
		<span class="size-3 rounded-xs" style="background-color: {heatColor(1)}"></span>
		<span class="size-3 rounded-xs" style="background-color: {heatColor(2)}"></span>
		<span class="size-3 rounded-xs" style="background-color: {heatColor(3)}"></span>
		<span class="size-3 rounded-xs" style="background-color: {heatColor(4)}"></span>
		{m.dashboard_calendar_heatmap_more()}
	</span>
</div>

<script lang="ts">
	import { isSameDay } from 'date-fns';
	import type {
		CalendarCompletedRead,
		CalendarPlannedRead
	} from '#lib/remote/reading-plan.remote.js';
	import MonthDay from './MonthDay.svelte';
	import { dateKey, forDay, type WeekDay } from './calendar-utils';

	type Props = {
		viewDate: Date;
		selectedDate: Date | null;
		openDayKey: string | null;
		weekDays: WeekDay[];
		monthDays: Date[];
		completedByDay: Record<string, CalendarCompletedRead[]>;
		plannedByDay: Record<string, CalendarPlannedRead[]>;
		dateFormatter: Intl.DateTimeFormat;
		onOpenChange: (day: Date, open: boolean) => void;
		onRemove: (item: CalendarPlannedRead) => void;
		onSchedule: () => void;
	};

	let {
		viewDate,
		selectedDate,
		openDayKey,
		weekDays,
		monthDays,
		completedByDay,
		plannedByDay,
		dateFormatter,
		onOpenChange,
		onRemove,
		onSchedule
	}: Props = $props();

	function isSelected(day: Date): boolean {
		return selectedDate != null && isSameDay(day, selectedDate);
	}
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div class="grid grid-cols-7 gap-1 p-1">
		{#each weekDays as weekDay, index (index)}
			<div
				class="truncate text-center text-sm font-semibold text-surface-500 uppercase"
				title={weekDay.long}
			>
				{weekDay.short}
			</div>
		{/each}
	</div>

	<div class="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-px overflow-hidden rounded-base">
		{#each monthDays as day (day.getTime())}
			<MonthDay
				{day}
				currentMonth={day.getMonth() === viewDate.getMonth() &&
					day.getFullYear() === viewDate.getFullYear()}
				selected={isSelected(day)}
				open={openDayKey === dateKey(day)}
				completed={forDay(completedByDay, day)}
				planned={forDay(plannedByDay, day)}
				{dateFormatter}
				onOpenChange={(open) => onOpenChange(day, open)}
				{onRemove}
				{onSchedule}
			/>
		{/each}
	</div>
</div>

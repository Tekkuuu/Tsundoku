<script lang="ts">
	import { addMonths, addYears, format, isSameMonth, startOfMonth } from 'date-fns';
	import { enUS, pl } from 'date-fns/locale';
	import { createRemoteActionHandler } from '#lib/client/form-handlers.js';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import {
		getReadingCalendar,
		unscheduleReading,
		type CalendarPlannedRead
	} from '#lib/remote/reading-plan.remote.js';
	import CalendarToolbar from './CalendarToolbar.svelte';
	import MonthCalendar from './MonthCalendar.svelte';
	import ScheduleReadDialog from './ScheduleReadDialog.svelte';
	import YearCalendar from './YearCalendar.svelte';
	import {
		buildMonthDays,
		buildWeekDays,
		dateKey,
		groupByDate,
		type CalendarView
	} from './calendar-utils';

	type Props = {
		/** Currently selected day. Bindable so the parent can react to picks. */
		selectedDate?: Date | null;
		/** Called whenever the user picks a day. */
		onSelectDate?: (date: Date) => void;
	};

	let { selectedDate = $bindable(null), onSelectDate }: Props = $props();

	const today = new Date();
	const localeCode = getLocale();
	const locale = localeCode === 'pl' ? pl : enUS;

	const fullDateFormatter = new Intl.DateTimeFormat(localeCode, {
		dateStyle: 'full'
	});

	let view = $state<CalendarView>('month');
	let viewDate = $state(startOfMonth(today));
	let openDayKey = $state<string | null>(null);
	let scheduleOpen = $state(false);

	const calendarData = getReadingCalendar();

	const weekDays = buildWeekDays(locale, today);
	const monthDays = $derived(buildMonthDays(viewDate));

	const title = $derived(
		view === 'month'
			? format(viewDate, 'LLLL yyyy', { locale })
			: format(viewDate, 'yyyy', { locale })
	);

	function selectDay(day: Date) {
		selectedDate = day;
		onSelectDate?.(day);
	}

	function openDay(day: Date) {
		selectDay(day);
		openDayKey = dateKey(day);

		// Leading/trailing days belong to another month, so move the view there
		// instead of treating the date as a valid pick inside the current month.
		if (!isSameMonth(day, viewDate)) {
			viewDate = startOfMonth(day);
		}
	}

	function handleDayOpenChange(day: Date, open: boolean) {
		if (open) {
			openDay(day);
		} else if (openDayKey === dateKey(day)) {
			openDayKey = null;
		}
	}

	function goToday() {
		viewDate = startOfMonth(today);
		view = 'month';
		openDay(today);
	}

	function openSchedule() {
		openDayKey = null;
		scheduleOpen = true;
	}

	function changeView(next: CalendarView) {
		openDayKey = null;
		view = next;
	}

	function step(direction: 1 | -1) {
		openDayKey = null;
		viewDate = view === 'month' ? addMonths(viewDate, direction) : addYears(viewDate, direction);
	}

	async function removeFromPlan(item: CalendarPlannedRead) {
		await createRemoteActionHandler({
			success: m.dashboard_calendar_unschedule_success(),
			error: m.dashboard_calendar_unschedule_error(),
			run: () => unscheduleReading({ id: item.id }),
			onSuccess: () => calendarData.refresh()
		})();
	}
</script>

{#if calendarData.error}
	<section class="card preset-filled-surface-100-900 p-3">
		<p class="text-sm text-surface-500">{m.dashboard_error_occurred()}</p>
	</section>
{:else if calendarData.current}
	{@const data = calendarData.current}
	{@const completedByDay = groupByDate(data.completed, (read) => read.completedAt)}
	{@const plannedByDay = groupByDate(data.planned, (item) => item.plannedDate)}

	<section
		class="flex w-full flex-col gap-2 card preset-filled-surface-100-900 p-2"
		aria-labelledby="reading-calendar-title"
	>
		<CalendarToolbar
			{view}
			{title}
			onViewChange={changeView}
			onPrev={() => step(-1)}
			onNext={() => step(1)}
			onToday={goToday}
		/>

		{#if view === 'month'}
			<MonthCalendar
				{viewDate}
				{selectedDate}
				{openDayKey}
				{weekDays}
				{monthDays}
				{completedByDay}
				{plannedByDay}
				dateFormatter={fullDateFormatter}
				onOpenChange={handleDayOpenChange}
				onRemove={removeFromPlan}
				onSchedule={openSchedule}
			/>
		{:else}
			<YearCalendar
				year={viewDate.getFullYear()}
				{weekDays}
				{selectedDate}
				{openDayKey}
				{completedByDay}
				{plannedByDay}
				dateFormatter={fullDateFormatter}
				onOpenChange={handleDayOpenChange}
				onRemove={removeFromPlan}
				onSchedule={openSchedule}
			/>
		{/if}

		{#if scheduleOpen && selectedDate}
			<ScheduleReadDialog
				bind:open={scheduleOpen}
				date={selectedDate}
				volumes={data.remaining}
				scheduledBookIds={data.planned.map((item) => item.bookId)}
				onScheduled={() => calendarData.refresh()}
			/>
		{/if}
	</section>
{:else}
	<div class="skeleton h-160 w-full rounded-base md:h-168 xl:h-176" aria-busy="true"></div>
{/if}

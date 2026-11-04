<script lang="ts">
	import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { m } from '#lib/paraglide/messages.js';
	import type { CalendarView } from './calendar-utils';

	type Props = {
		view: CalendarView;
		title: string;
		onViewChange: (view: CalendarView) => void;
		onPrev: () => void;
		onNext: () => void;
		onToday: () => void;
	};

	let { view, title, onViewChange, onPrev, onNext, onToday }: Props = $props();
</script>

<header class="flex flex-wrap items-center justify-between gap-2">
	<div class="flex min-w-0 items-center gap-2">
		<CalendarDays class="size-5 shrink-0" />
		<h2 id="reading-calendar-title" class="truncate text-xl font-semibold">
			{m.dashboard_calendar_title()}
		</h2>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<div
			class="flex items-center gap-1 rounded-base bg-surface-200-800 p-0.5"
			role="group"
			aria-label={m.dashboard_calendar_view_switch()}
		>
			<button
				type="button"
				class="btn btn-sm {view === 'month' ? 'preset-filled-primary-500' : 'preset-tonal'}"
				aria-pressed={view === 'month'}
				onclick={() => onViewChange('month')}
			>
				{m.dashboard_calendar_view_month()}
			</button>
			<button
				type="button"
				class="btn btn-sm {view === 'year' ? 'preset-filled-primary-500' : 'preset-tonal'}"
				aria-pressed={view === 'year'}
				onclick={() => onViewChange('year')}
			>
				{m.dashboard_calendar_view_year()}
			</button>
		</div>

		<button type="button" class="btn preset-tonal" onclick={onToday}>
			{m.dashboard_calendar_today()}
		</button>
	</div>
</header>

<div class="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
	<button
		type="button"
		class="btn preset-tonal p-2"
		aria-label={view === 'month'
			? m.dashboard_calendar_previous_month()
			: m.dashboard_calendar_previous_year()}
		onclick={onPrev}
	>
		<ChevronLeft class="size-5" />
	</button>
	<p class="truncate text-center text-lg font-semibold capitalize tabular-nums" aria-live="polite">
		{title}
	</p>
	<button
		type="button"
		class="btn preset-tonal p-2"
		aria-label={view === 'month'
			? m.dashboard_calendar_next_month()
			: m.dashboard_calendar_next_year()}
		onclick={onNext}
	>
		<ChevronRight class="size-5" />
	</button>
</div>

<script lang="ts">
	import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
	import type {
		CalendarCompletedRead,
		CalendarPlannedRead
	} from '#lib/remote/reading-plan.remote.js';
	import DayDetails from './DayDetails.svelte';
	import { dayAriaLabel } from './calendar-labels';
	import { heatColor, heatmapCornerClasses, type HeatmapCorner } from './calendar-utils';

	type Props = {
		day: Date;
		corners?: HeatmapCorner[];
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
		corners = [],
		selected,
		open,
		completed,
		planned,
		dateFormatter,
		onOpenChange,
		onRemove,
		onSchedule
	}: Props = $props();

	function heatClass(selected: boolean): string {
		const base =
			'relative aspect-square shrink-0 transition-colors focus-visible:z-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500';
		const shape = `${base} ${heatmapCornerClasses(corners)}`;

		return selected
			? `${shape} z-50 outline outline-2 outline-offset-1 outline-primary-500`
			: shape;
	}
</script>

<Popover {open} onOpenChange={(details) => onOpenChange(details.open)}>
	<Popover.Trigger
		type="button"
		class={heatClass(selected)}
		style="background-color: {heatColor(completed.length)}"
		aria-label={dayAriaLabel(day, completed, planned, dateFormatter)}
	></Popover.Trigger>

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

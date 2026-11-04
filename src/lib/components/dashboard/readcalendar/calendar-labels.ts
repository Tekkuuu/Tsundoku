import { m } from '#lib/paraglide/messages.js';

export type CalendarEntry = {
	seriesTitle: string;
	volumeNumber: number;
};

export function entryLabel(entry: CalendarEntry): string {
	return m.dashboard_calendar_read_entry({
		title: entry.seriesTitle,
		volumeNumber: entry.volumeNumber
	});
}

export function daySummary(
	completed: CalendarEntry[],
	planned: CalendarEntry[]
): string | undefined {
	const parts: string[] = [];
	if (completed.length > 0) {
		parts.push(`${m.dashboard_calendar_completed()}: ${completed.map(entryLabel).join(', ')}`);
	}
	if (planned.length > 0) {
		parts.push(`${m.dashboard_calendar_planned()}: ${planned.map(entryLabel).join(', ')}`);
	}
	return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function dayAriaLabel(
	day: Date,
	completed: CalendarEntry[],
	planned: CalendarEntry[],
	formatter: Intl.DateTimeFormat
): string {
	const date = formatter.format(day);
	const summary = daySummary(completed, planned);
	if (!summary) return m.dashboard_calendar_select_day({ date });
	return m.dashboard_calendar_day_with_reads({ date, reads: summary });
}

import type { enUS } from 'date-fns/locale';
import { addDays, eachDayOfInterval, format, startOfMonth, startOfWeek } from 'date-fns';

export type CalendarLocale = typeof enUS;
export type CalendarView = 'month' | 'year';

export type WeekDay = {
	narrow: string;
	short: string;
	long: string;
};

export type DayMarkerKind = 'completed' | 'planned';
export type HeatmapCorner = 'tl' | 'tr' | 'bl' | 'br';

const HEATMAP_CORNER_CLASSES: Record<HeatmapCorner, string> = {
	tl: 'rounded-tl-sm',
	tr: 'rounded-tr-sm',
	bl: 'rounded-bl-sm',
	br: 'rounded-br-sm'
};

export function heatmapCornerClasses(corners: HeatmapCorner[]): string {
	return corners.map((corner) => HEATMAP_CORNER_CLASSES[corner]).join(' ');
}

export function buildWeekDays(locale: CalendarLocale, today: Date): WeekDay[] {
	const start = startOfWeek(today, { weekStartsOn: 1 });
	return eachDayOfInterval({ start, end: addDays(start, 6) }).map((day) => ({
		narrow: format(day, 'EEEEE', { locale }),
		short: format(day, 'EEE', { locale }),
		long: format(day, 'EEEE', { locale })
	}));
}

export function buildMonthDays(viewDate: Date): Date[] {
	const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 });
	return eachDayOfInterval({ start, end: addDays(start, 41) });
}

export function dateKey(day: Date): string {
	return format(day, 'yyyy-MM-dd');
}

export function groupByDate<T>(items: T[], getDate: (item: T) => string): Record<string, T[]> {
	const byDay: Record<string, T[]> = {};
	for (const item of items) {
		const key = getDate(item);
		const existing = byDay[key];
		if (existing) existing.push(item);
		else byDay[key] = [item];
	}
	return byDay;
}

export function forDay<T>(byDay: Record<string, T[]>, day: Date): T[] {
	return byDay[dateKey(day)] ?? [];
}

export function markerClass(kind: DayMarkerKind, selected: boolean): string {
	if (kind === 'completed') {
		return selected ? 'bg-primary-contrast-500' : 'bg-primary-500';
	}
	return selected ? 'border border-primary-contrast-500' : 'border border-primary-500';
}

export function heatColor(level: number): string {
	const percentage = level <= 0 ? 0 : Math.min(100, level * 25);
	return `color-mix(in oklab, var(--color-primary-500) ${percentage}%, var(--color-surface-50-950))`;
}

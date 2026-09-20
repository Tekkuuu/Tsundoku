import { m } from '$lib/paraglide/messages';

export function getSeriesStatusText(status: string) {
	switch (status.toLowerCase()) {
		case 'ongoing':
			return m.db_seriesstatus_ongoing();
		case 'hiatus':
			return m.db_seriesstatus_hiatus();
		case 'completed':
			return m.db_seriesstatus_completed();
		case 'cancelled':
			return m.db_seriesstatus_cancelled();
		default:
			return status; // Fallback if unknown
	}
}

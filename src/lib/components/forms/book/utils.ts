import { m } from '$lib/paraglide/messages';
import type { BookStatus, ReadStatus } from '$lib/validation/book';

/** True when moving to `status` would discard read progress and needs confirmation. */
export function needsReadReset(status: BookStatus, readStatus: ReadStatus): boolean {
	return status !== 'Owned' && readStatus !== 'Not Read';
}

export function getBookStatusText(status: string) {
	switch (status.toLowerCase()) {
		case 'wishlist':
			return m.db_bookstatus_wishlist();
		case 'ordered':
			return m.db_bookstatus_ordered();
		case 'owned':
			return m.db_bookstatus_owned();
		default:
			return status;
	}
}

export function getReadStatusText(status: string) {
	switch (status.toLowerCase()) {
		case 'not read':
			return m.db_readstatus_notread();
		case 'reading':
			return m.db_readstatus_reading();
		case 'completed':
			return m.db_readstatus_completed();
		default:
			return status;
	}
}

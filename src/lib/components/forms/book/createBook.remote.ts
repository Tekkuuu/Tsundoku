import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error, invalid } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { requireOwnedFile } from '$lib/server/files';
import { CreateBookSchema, parseBoughtAtMonth } from '$lib/validation/book';

function findPgError(err: unknown): {
	code?: unknown;
	constraint_name?: unknown;
	constraint?: unknown;
} | null {
	let cur: unknown = err;
	for (let i = 0; i < 4 && typeof cur === 'object' && cur !== null; i++) {
		const e = cur as Record<string, unknown>;
		if (e['code'] === '23505') {
			return e as { code?: unknown; constraint_name?: unknown; constraint?: unknown };
		}
		cur = e['cause'];
	}
	return null;
}

function isUniqueVolumeViolation(err: unknown): boolean {
	const pg = findPgError(err);
	if (!pg) return false;
	const constraint = String(pg.constraint_name ?? pg.constraint ?? '');
	return !constraint || constraint.includes('unique_user_series_volume');
}

export const createBook = form(CreateBookSchema, async (data, issue) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized book creation attempt');
		error(401, 'Unauthorized');
	}

	// Empty means "never entered" (null), distinct from '0.00' (free).
	// Currency is required by validation whenever either price is set.
	// Invariant: prices are either both set or both null. Original defaults
	// to paid (no discount assumed); without paid there is no retail value
	// to attribute, so a stale original would fake "savings" in stats.
	const paidPrice = data.paidPrice?.trim() ? data.paidPrice.trim() : null;
	const originalPrice =
		paidPrice === null ? null : data.originalPrice?.trim() ? data.originalPrice.trim() : paidPrice;
	const currencyCode = data.currencyCode?.trim() || null;

	const { boughtAt, coverFileId, ...rest } = data;

	// A linked cover must be the caller's own staged upload (404 otherwise —
	// linking another user's file would grant read access through this book).
	let coverFile: string | null = null;
	if (coverFileId) {
		await requireOwnedFile(db, coverFileId, locals.user.id, 'cover');
		coverFile = coverFileId;
	}

	try {
		await db.insert(book).values({
			...rest,
			coverFileId: coverFile,
			userId: locals.user.id,
			paidPrice,
			originalPrice,
			currencyCode,
			boughtAt: parseBoughtAtMonth(boughtAt) ?? null
		});
	} catch (err) {
		if (isUniqueVolumeViolation(err)) {
			logger.warn({ userId: locals.user.id, seriesId: data.seriesId }, 'Duplicate book volume');
			invalid(issue.volumeNumber(`Vol. ${data.volumeNumber} already exists`));
		}
		throw err;
	}
});

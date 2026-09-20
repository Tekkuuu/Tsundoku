import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { book, orderItem, series } from '$lib/server/db/schema';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Same predicate as the "unknown purchase date" bucket in the monthly
	// finance stats: owned/ordered books linked to no order and with no
	// manual bought-at month.
	const rows = await db
		.select({
			id: book.id,
			seriesId: book.seriesId,
			seriesTitle: series.title,
			volumeNumber: book.volumeNumber,
			paidPrice: book.paidPrice,
			currencyCode: book.currencyCode
		})
		.from(book)
		.innerJoin(series, eq(series.id, book.seriesId))
		.leftJoin(orderItem, eq(orderItem.bookId, book.id))
		.where(
			and(
				eq(book.userId, locals.user.id),
				inArray(book.status, ['Ordered', 'Owned']),
				isNull(orderItem.id),
				isNull(book.boughtAt)
			)
		);

	logger.debug({ userId: locals.user.id, count: rows.length }, 'Fetched undated books');

	const books = rows.toSorted(
		(a, b) => a.seriesTitle.localeCompare(b.seriesTitle) || a.volumeNumber - b.volumeNumber
	);

	return { books };
};

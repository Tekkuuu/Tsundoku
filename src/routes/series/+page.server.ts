import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { series, book } from '$lib/server/db/schema';
import { and, eq, desc, inArray } from 'drizzle-orm';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	logger.debug({ userId: locals.user.id }, 'Fetching user series');
	const userId = locals.user.id;
	const se = await db
		.select()
		.from(series)
		.where(eq(series.userId, userId))
		.orderBy(desc(series.title));

	if (se.length === 0) {
		return { seriesEntries: [] };
	}

	const latestVolumes = await db
		.selectDistinctOn([book.seriesId], {
			seriesId: book.seriesId,
			volumeNumber: book.volumeNumber,
			coverFileId: book.coverFileId
		})
		.from(book)
		.where(
			and(
				eq(book.userId, userId),
				inArray(
					book.seriesId,
					se.map((s) => s.id)
				)
			)
		)
		.orderBy(book.seriesId, desc(book.volumeNumber));
	logger.debug({ userId, seriesCount: se.length }, 'Fetched user series');

	const latestBySeriesId = new Map(latestVolumes.map((v) => [v.seriesId, v]));
	const seriesEntries = se.map((entry) => ({
		...entry,
		latestVolume: latestBySeriesId.get(entry.id)
	}));

	return {
		seriesEntries
	};
};

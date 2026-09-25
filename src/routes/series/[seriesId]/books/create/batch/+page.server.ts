import { db } from '$lib/server/db';
import { book, series } from '$lib/server/db/schema';
import { eq, and, max } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const seriesInfo = (
		await db
			.select()
			.from(series)
			.where(and(eq(series.id, params.seriesId), eq(series.userId, locals.user.id)))
			.limit(1)
	)[0];

	if (!seriesInfo) {
		logger.warn(
			{ userId: locals.user.id, seriesId: params.seriesId },
			'Series not found for batch book creation'
		);
		error(404, { message: 'Series not found' });
	}

	const [volumeStats] = await db
		.select({ maxVolume: max(book.volumeNumber) })
		.from(book)
		.where(and(eq(book.seriesId, params.seriesId), eq(book.userId, locals.user.id)));

	return { seriesInfo, nextVolume: (volumeStats?.maxVolume ?? 0) + 1 };
};

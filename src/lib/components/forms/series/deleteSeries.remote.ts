import { command, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { series } from '$lib/server/db/schema';
import { DeleteSeriesSchema } from '$lib/validation/series';
import { and, eq } from 'drizzle-orm';

export const deleteSeries = command(DeleteSeriesSchema, async (deletedSeries) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized series deletion attempt');
		error(401, 'Unauthorized');
	}

	await db
		.delete(series)
		.where(and(eq(series.id, deletedSeries.id), eq(series.userId, locals.user.id)));
});

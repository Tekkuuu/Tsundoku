import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { series } from '$lib/server/db/schema';
import { UpdateSeriesSchema } from '$lib/validation/series';
import { and, eq } from 'drizzle-orm';

export const updateSeries = form(UpdateSeriesSchema, async (updatedSeries) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized series update attempt');
		error(401, 'Unauthorized');
	}

	await db
		.update(series)
		.set(updatedSeries)
		.where(and(eq(series.id, updatedSeries.id), eq(series.userId, locals.user.id)));
});

import { command, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { series } from '$lib/server/db/schema';
import { UpdateSeriesStatusSchema } from '$lib/validation/series';
import { and, eq } from 'drizzle-orm';

export const updateSeriesStatus = command(UpdateSeriesStatusSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized series status update attempt');
		error(401, 'Unauthorized');
	}

	await db
		.update(series)
		.set({ status: data.status })
		.where(and(eq(series.id, data.id), eq(series.userId, locals.user.id)));
});

import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { series } from '$lib/server/db/schema';
import { CreateSeriesSchema } from '$lib/validation/series';

export const createSeries = form(CreateSeriesSchema, async (createdSeries) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized series creation attempt');
		error(401, 'Unauthorized');
	}

	await db.insert(series).values({
		...createdSeries,
		userId: locals.user.id
	});
});

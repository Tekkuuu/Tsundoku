import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error, invalid } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { series } from '$lib/server/db/schema';
import { isUniqueViolation } from '$lib/server/db/errors';
import { CreateSeriesSchema } from '$lib/validation/series';

export const createSeries = form(CreateSeriesSchema, async (createdSeries) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized series creation attempt');
		error(401, 'Unauthorized');
	}

	try {
		await db.insert(series).values({
			...createdSeries,
			userId: locals.user.id
		});
	} catch (err) {
		if (isUniqueViolation(err, 'unique_user_series_title_author')) {
			logger.warn({ userId: locals.user.id }, 'Duplicate series on create');
			invalid('A series with this title and author already exists');
		}
		throw err;
	}
});

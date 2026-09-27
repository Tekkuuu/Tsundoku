import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error, invalid } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { series } from '$lib/server/db/schema';
import { isUniqueViolation } from '$lib/server/db/errors';
import { UpdateSeriesSchema } from '$lib/validation/series';
import { and, eq } from 'drizzle-orm';

export const updateSeries = form(UpdateSeriesSchema, async (updatedSeries) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized series update attempt');
		error(401, 'Unauthorized');
	}

	try {
		await db
			.update(series)
			.set(updatedSeries)
			.where(and(eq(series.id, updatedSeries.id), eq(series.userId, locals.user.id)));
	} catch (err) {
		if (isUniqueViolation(err, 'unique_user_series_title_author')) {
			logger.warn(
				{ userId: locals.user.id, seriesId: updatedSeries.id },
				'Duplicate series on update'
			);
			invalid('Another series with this title and author already exists');
		}
		throw err;
	}
});

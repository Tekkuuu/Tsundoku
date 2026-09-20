import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	logger.debug({ userId: locals.user.id }, 'Fetching user orders');
	const orders = await db.query.order.findMany({
		where: (order, { eq }) => eq(order.userId, locals.user!.id),
		with: {
			items: {
				with: {
					book: {
						columns: {
							paidPrice: true,
							originalPrice: true,
							volumeNumber: true,
							coverFileId: true
						},
						with: {
							series: {
								columns: {
									title: true,
									author: true
								}
							}
						}
					}
				}
			},
			adjustments: true
		}
	});

	return { orders };
};

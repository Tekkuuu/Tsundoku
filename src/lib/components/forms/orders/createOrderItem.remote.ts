import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error, invalid } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { book, order, orderItem } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { CreateOrderItemSchema } from '$lib/validation/order';

function findPgError(err: unknown): {
	code?: unknown;
	constraint_name?: unknown;
	constraint?: unknown;
} | null {
	let cur: unknown = err;
	for (let i = 0; i < 4 && typeof cur === 'object' && cur !== null; i++) {
		const e = cur as Record<string, unknown>;
		if (e['code'] === '23505') {
			return e as { code?: unknown; constraint_name?: unknown; constraint?: unknown };
		}
		cur = e['cause'];
	}
	return null;
}

function isUniqueBookViolation(err: unknown): boolean {
	const pg = findPgError(err);
	if (!pg) return false;
	const constraint = String(pg.constraint_name ?? pg.constraint ?? '');
	return !constraint || constraint.includes('unique_book_order');
}

export const createOrderItem = form(CreateOrderItemSchema, async (data, issue) => {
	const { locals, params } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order item creation attempt');
		error(401, 'Unauthorized');
	}

	const orderId = params.orderId;
	if (!orderId) {
		logger.warn('Create order item failed - no order ID in route');
		error(400, 'Order ID is required');
	}

	const existingOrder = await db.query.order.findFirst({
		where: and(eq(order.id, orderId), eq(order.userId, locals.user.id))
	});

	if (!existingOrder) {
		logger.warn({ userId: locals.user.id, orderId }, 'Create order item failed - order not found');
		error(404, 'Order not found');
	}

	const existingBook = await db.query.book.findFirst({
		where: and(eq(book.id, data.bookId), eq(book.userId, locals.user.id))
	});

	if (!existingBook) {
		logger.warn(
			{ userId: locals.user.id, bookId: data.bookId },
			'Create order item faild - book does not exists'
		);
		error(404, 'Book not found');
	}

	if (existingBook.currencyCode !== existingOrder.currencyCode) {
		logger.warn(
			{
				userId: locals.user.id,
				orderId,
				bookId: data.bookId,
				bookCurrency: existingBook.currencyCode,
				orderCurrency: existingOrder.currencyCode
			},
			'Create order item failed - currency mismatch'
		);
		invalid(
			issue.bookId(
				existingBook.currencyCode
					? `This book is priced in ${existingBook.currencyCode}, but the order is in ${existingOrder.currencyCode}`
					: 'This book has no price set and cannot be added to an order'
			)
		);
	}

	try {
		await db.transaction(async (tx) => {
			await tx.insert(orderItem).values({
				orderId,
				bookId: data.bookId,
				userId: locals.user!.id
			});
			logger.info(
				{ userId: locals.user!.id, orderId, bookId: data.bookId },
				'Order item added successfully'
			);

			await tx
				.update(book)
				.set({
					status: 'Ordered'
				})
				.where(
					and(
						eq(book.userId, locals.user!.id),
						eq(book.id, data.bookId),
						eq(book.status, 'Wishlist')
					)
				);
			logger.info(
				{ userId: locals.user!.id, bookId: data.bookId },
				'Book status set to Ordered successfully'
			);
		});
	} catch (err) {
		if (isUniqueBookViolation(err)) {
			logger.warn({ userId: locals.user.id, orderId, bookId: data.bookId }, 'Duplicate order item');
			invalid(issue.bookId('This book is already part of an order'));
		}
		logger.error(
			{
				userId: locals.user.id,
				orderId,
				error: err instanceof Error ? err.message : String(err)
			},
			'Failed to add order item'
		);
		throw err;
	}
});

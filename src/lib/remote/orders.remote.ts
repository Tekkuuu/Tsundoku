import { command, form, getRequestEvent, query } from '$app/server';
import { error, invalid, redirect } from '@sveltejs/kit';
import { and, count, desc, eq, exists, not, or, sql, type Column, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '#lib/server/db/index.js';
import { book, order, orderAdjustment, orderItem, series } from '#lib/server/db/schema.js';
import { isUniqueViolation } from '#lib/server/db/errors.js';
import { logger } from '#lib/server/logger.js';
import { trgmMatch } from '#lib/server/db/trgm.js';
import { deleteOwnedFile, requireOwnedFile } from '#lib/server/services/files.js';
import { parseSearchTerm, tokenizeSearchQuery, type ParsedSearchTerm } from '#lib/shared/search.js';
import {
	CreateOrderAdjustmentSchema,
	CreateOrderItemSchema,
	CreateOrderSchema,
	DeleteOrderAdjustmentSchema,
	DeleteOrderItemSchema,
	DeleteOrderSchema,
	UpdateOrderAdjustmentSchema,
	UpdateOrderSchema
} from '#lib/shared/validation/order.js';

type OrderSearchTerm = ParsedSearchTerm;

const itemFields = new Set(['title', 'author', 'volume', 'paidprice', 'originalprice']);

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, '\\$&');
}

function compareNumeric(column: Column | SQL, operator: string, value: string): SQL {
	const target = Number(value);
	if (Number.isNaN(target)) return sql`false`;

	switch (operator) {
		case '>':
			return sql`${column} > ${target}`;
		case '<':
			return sql`${column} < ${target}`;
		case '>=':
			return sql`${column} >= ${target}`;
		case '<=':
			return sql`${column} <= ${target}`;
		default:
			return sql`${column} = ${target}`;
	}
}

function compareDate(column: Column | SQL, operator: string, value: string): SQL {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return sql`false`;

	const safeOperator = ['>', '<', '>=', '<='].includes(operator) ? operator : '=';
	return sql`${column}::date ${sql.raw(safeOperator)} ${value}::date`;
}

function orderItemCondition(term: OrderSearchTerm, userId: string): SQL {
	const value = term.value;
	let condition: SQL;

	switch (term.field) {
		case 'title':
			condition = trgmMatch(series.title, value);
			break;
		case 'author':
			condition = trgmMatch(sql`coalesce(${series.author}, '')`, value);
			break;
		case 'volume':
			condition = compareNumeric(book.volumeNumber, term.operator, value);
			break;
		case 'paidprice':
			condition = compareNumeric(book.paidPrice, term.operator, value);
			break;
		case 'originalprice':
			condition = compareNumeric(book.originalPrice, term.operator, value);
			break;
		case '': {
			const pattern = `%${escapeLike(value)}%`;
			condition =
				or(
					trgmMatch(series.title, value),
					trgmMatch(sql`coalesce(${series.author}, '')`, value),
					sql`cast(${book.volumeNumber} as text) ilike ${pattern}`,
					sql`cast(${book.paidPrice} as text) ilike ${pattern}`,
					sql`cast(${book.originalPrice} as text) ilike ${pattern}`
				) ?? sql`false`;
			break;
		}
		default:
			condition = sql`false`;
	}

	return exists(
		db
			.select({ matched: sql`1` })
			.from(orderItem)
			.innerJoin(book, eq(orderItem.bookId, book.id))
			.innerJoin(series, eq(book.seriesId, series.id))
			.where(and(eq(orderItem.orderId, order.id), eq(orderItem.userId, userId), condition))
	);
}

function orderTermCondition(term: OrderSearchTerm, userId: string): SQL {
	let condition: SQL;

	switch (term.field) {
		case 'order':
			condition = trgmMatch(sql`coalesce(${order.orderNumber}, '')`, term.value);
			break;
		case 'store':
			condition = trgmMatch(order.storeName, term.value);
			break;
		case 'note':
			condition = trgmMatch(sql`coalesce(${order.note}, '')`, term.value);
			break;
		case 'date':
			condition = compareDate(order.orderDate, term.operator, term.value);
			break;
		case '':
			condition =
				or(
					trgmMatch(sql`coalesce(${order.orderNumber}, '')`, term.value),
					trgmMatch(order.storeName, term.value),
					trgmMatch(sql`coalesce(${order.note}, '')`, term.value)
				) ?? sql`false`;
			condition = or(condition, orderItemCondition(term, userId)) ?? condition;
			break;
		default:
			condition = itemFields.has(term.field) ? orderItemCondition(term, userId) : sql`false`;
	}

	return term.negated ? not(condition) : condition;
}

export const getOrders = query(
	z.object({
		count: z.number().int().positive(),
		page: z.number().int().positive(),
		search: z.string().trim().optional()
	}),
	async (params) => {
		const { locals } = getRequestEvent();

		if (!locals.user) {
			logger.warn('Unauthorized orders fetch attempt');
			error(401, 'Unauthorized');
		}

		const userId = locals.user.id;
		const terms = params.search
			? tokenizeSearchQuery(params.search)
					.map(parseSearchTerm)
					.filter((term) => term.value !== '')
			: [];
		const where = and(
			eq(order.userId, userId),
			...terms.map((term) => orderTermCondition(term, userId))
		);

		const [countRows, orders] = await Promise.all([
			db.select({ count: count() }).from(order).where(where),
			db.query.order.findMany({
				where,
				orderBy: [desc(order.orderDate), desc(order.id)],
				limit: params.count,
				offset: params.count * (params.page - 1),
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
			})
		]);

		const total = Number(countRows.at(0)?.count ?? 0);
		logger.debug({ userId, orderCount: orders.length, total }, 'Fetched user orders');

		return { orders, total };
	}
);

export const createOrder = form(CreateOrderSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order creation attempt');
		error(401, 'Unauthorized');
	}

	const { orderDate, receiptFileId, ...rest } = data;
	// Currency is required by validation: the user must provide it.
	const currencyCode = data.currencyCode.trim();

	// A linked receipt must be the caller's own staged upload (404 otherwise —
	// linking another user's file would grant read access through this order).
	let receiptFile: string | null = null;
	if (receiptFileId) {
		await requireOwnedFile(db, receiptFileId, locals.user.id, 'receipt');
		receiptFile = receiptFileId;
	}

	const [newOrder] = await db
		.insert(order)
		.values({
			...rest,
			receiptFileId: receiptFile,
			userId: locals.user.id,
			currencyCode,
			orderDate: orderDate ? new Date(orderDate) : undefined
		})
		.returning({ id: order.id });

	logger.info({ userId: locals.user.id, orderId: newOrder.id }, 'Order created');

	redirect(303, `/orders/${newOrder.id}`);
});

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
		if (isUniqueViolation(err, 'unique_book_order')) {
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

export const createOrderAdjustment = form(CreateOrderAdjustmentSchema, async (data) => {
	const { locals, params } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order adjustment creation attempt');
		error(401, 'Unauthorized');
	}

	const orderId = params.orderId;
	if (!orderId) {
		logger.warn('Create order adjustment failed - no order ID in route');
		error(400, 'Order ID is required');
	}

	const existingOrder = await db.query.order.findFirst({
		where: and(eq(order.id, orderId), eq(order.userId, locals.user.id))
	});

	if (!existingOrder) {
		logger.warn(
			{ userId: locals.user.id, orderId },
			'Create order adjustment failed - order not found'
		);
		error(404, 'Order not found');
	}

	try {
		await db.insert(orderAdjustment).values({
			orderId,
			name: data.name,
			amount: data.amount,
			userId: locals.user.id
		});
		logger.info(
			{ userId: locals.user.id, orderId, name: data.name },
			'Order adjustment added successfully'
		);
	} catch (err) {
		logger.error(
			{
				userId: locals.user.id,
				orderId,
				error: err instanceof Error ? err.message : String(err)
			},
			'Failed to add order adjustment'
		);
		error(500, 'Failed to add order adjustment');
	}
});

export const updateOrder = form(UpdateOrderSchema, async (data, issue) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order update attempt');
		error(401, 'Unauthorized');
	}

	const { id, orderDate, receiptFileId, ...rest } = data;
	// The order currency anchors every item total and is required by
	// validation: the user must provide it, never silently defaulted.
	const currencyCode = rest.currencyCode.trim();

	// '' clears the receipt, a UUID links a staged upload (ownership
	// verified), undefined leaves it untouched.
	let receiptFileUpdate: { receiptFileId: string | null } | null = null;
	if (receiptFileId !== undefined) {
		if (receiptFileId === '') {
			receiptFileUpdate = { receiptFileId: null };
		} else {
			await requireOwnedFile(db, receiptFileId, locals.user.id, 'receipt');
			receiptFileUpdate = { receiptFileId };
		}
	}

	// Lock the currency while the order has books so the total can't silently
	// become a mixed-currency sum.
	const [current] = await db
		.select({ currencyCode: order.currencyCode, receiptFileId: order.receiptFileId })
		.from(order)
		.where(and(eq(order.id, id), eq(order.userId, locals.user.id)))
		.limit(1);
	if (current && currencyCode !== current.currencyCode) {
		const items = await db
			.select({ id: orderItem.id })
			.from(orderItem)
			.where(and(eq(orderItem.orderId, id), eq(orderItem.userId, locals.user.id)))
			.limit(1);
		if (items.length > 0) {
			logger.warn({ userId: locals.user.id, orderId: id }, 'Currency change on order with items');
			invalid(issue.currencyCode('Currency is locked while this order has books'));
		}
	}

	await db
		.update(order)
		.set({
			storeName: rest.storeName,
			orderNumber: rest.orderNumber,
			currencyCode,
			...(receiptFileUpdate !== null ? receiptFileUpdate : {}),
			note: rest.note,
			// Required by validation: always overwrite, never clear.
			orderDate: new Date(orderDate)
		})
		.where(and(eq(order.id, id), eq(order.userId, locals.user.id)));

	// Delete replaced/cleared bytes only after the update succeeded.
	const previousReceipt = current?.receiptFileId ?? null;
	const nextReceipt =
		receiptFileUpdate !== null ? receiptFileUpdate.receiptFileId : previousReceipt;
	if (previousReceipt && previousReceipt !== nextReceipt) {
		await deleteOwnedFile(db, previousReceipt, locals.user.id);
	}
});

export const updateOrderAdjustment = form(UpdateOrderAdjustmentSchema, async (data) => {
	const { locals, params } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order adjustment update attempt');
		error(401, 'Unauthorized');
	}

	const orderId = params.orderId;
	if (!orderId) {
		logger.warn('Update order adjustment failed - no order ID in route');
		error(400, 'Order ID is required');
	}

	const { id, ...rest } = data;

	const existingOrder = await db.query.order.findFirst({
		where: and(eq(order.id, orderId), eq(order.userId, locals.user.id))
	});

	if (!existingOrder) {
		logger.warn(
			{ userId: locals.user.id, orderId },
			'Update order adjustment failed - order not found'
		);
		error(404, 'Order not found');
	}

	await db
		.update(orderAdjustment)
		.set({
			name: rest.name,
			amount: rest.amount
		})
		.where(
			and(
				eq(orderAdjustment.id, id),
				eq(orderAdjustment.orderId, orderId),
				eq(orderAdjustment.userId, locals.user.id)
			)
		);
});

export const deleteOrder = command(DeleteOrderSchema, async ({ id }) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order deletion attempt');
		error(401, 'Unauthorized');
	}

	const [current] = await db
		.select({ receiptFileId: order.receiptFileId })
		.from(order)
		.where(and(eq(order.id, id), eq(order.userId, locals.user.id)))
		.limit(1);

	await db.delete(order).where(and(eq(order.id, id), eq(order.userId, locals.user.id)));

	if (current?.receiptFileId) {
		await deleteOwnedFile(db, current.receiptFileId, locals.user.id);
	}
});

export const deleteOrderItem = command(DeleteOrderItemSchema, async ({ id }) => {
	const { locals, params } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order item deletion attempt');
		error(401, 'Unauthorized');
	}

	const orderId = params.orderId;
	if (!orderId) {
		logger.warn('Delete order item failed - no order ID in route');
		error(400, 'Order ID is required');
	}

	const existingOrder = await db.query.order.findFirst({
		where: and(eq(order.id, orderId), eq(order.userId, locals.user.id))
	});

	if (!existingOrder) {
		logger.warn({ userId: locals.user.id, orderId }, 'Delete order item failed - order not found');
		error(404, 'Order not found');
	}

	await db
		.delete(orderItem)
		.where(
			and(
				eq(orderItem.id, id),
				eq(orderItem.orderId, orderId),
				eq(orderItem.userId, locals.user.id)
			)
		);
});

export const deleteOrderAdjustment = command(DeleteOrderAdjustmentSchema, async ({ id }) => {
	const { locals, params } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized order adjustment deletion attempt');
		error(401, 'Unauthorized');
	}

	const orderId = params.orderId;
	if (!orderId) {
		logger.warn('Delete order adjustment failed - no order ID in route');
		error(400, 'Order ID is required');
	}

	const existingOrder = await db.query.order.findFirst({
		where: and(eq(order.id, orderId), eq(order.userId, locals.user.id))
	});

	if (!existingOrder) {
		logger.warn(
			{ userId: locals.user.id, orderId },
			'Delete order adjustment failed - order not found'
		);
		error(404, 'Order not found');
	}

	await db
		.delete(orderAdjustment)
		.where(
			and(
				eq(orderAdjustment.id, id),
				eq(orderAdjustment.orderId, orderId),
				eq(orderAdjustment.userId, locals.user.id)
			)
		);
});

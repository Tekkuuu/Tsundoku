import { form, getRequestEvent } from '$app/server';
import { logger } from '$lib/server/logger';
import { error, invalid } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { order, orderItem } from '$lib/server/db/schema';
import { deleteOwnedFile, requireOwnedFile } from '$lib/server/files';
import { UpdateOrderSchema } from '$lib/validation/order';
import { and, eq } from 'drizzle-orm';

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
			receiptUrl: rest.receiptUrl,
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

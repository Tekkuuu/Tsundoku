import { z } from 'zod/v4';

/**
 * Self-hosted file id from the upload/import endpoints. Forms always submit
 * the hidden input, so '' (not undefined) means "no file" on create and
 * "clear the file" on update.
 */
const fileIdField = z.union([z.uuidv4(), z.literal('')]).optional();

const orderDateField = z
	.string()
	.nonempty({ message: 'Order date is required' })
	.refine((val) => !Number.isNaN(new Date(val).getTime()), {
		message: 'Enter a valid date'
	});

const currencyCodeField = z
	.string()
	.trim()
	.nonempty({ message: 'Currency is required' })
	.refine((value) => /^[A-Z]{3}$/.test(value), {
		message: 'Currency must be a three-letter uppercase ISO code'
	});

const base = z.object({
	storeName: z.string().nonempty({ message: 'Store name is required' }),
	orderNumber: z.string().optional(),
	orderDate: orderDateField,
	currencyCode: currencyCodeField,
	receiptUrl: z.string().optional(),
	receiptFileId: fileIdField,
	note: z.string().optional()
});

export const CreateOrderSchema = base;

export const UpdateOrderSchema = base.partial().extend({
	id: z.uuidv4().nonempty(),
	orderDate: orderDateField,
	currencyCode: currencyCodeField
});

export const SelectOrderSchema = base.extend({
	id: z.uuidv4().nonempty(),
	userId: z.uuidv4().nonempty(),
	orderDate: z.coerce.date()
});

export const DeleteOrderSchema = z.object({
	id: z.uuidv4().nonempty()
});

export const CreateOrderItemSchema = z.object({
	bookId: z.uuidv4().nonempty({ message: 'A book must be selected' })
});

export const SelectOrderItemSchema = CreateOrderItemSchema.extend({
	id: z.uuidv4().nonempty(),
	userId: z.uuidv4().nonempty(),
	orderId: z.uuidv4().nonempty()
});

export const DeleteOrderItemSchema = z.object({
	id: z.uuidv4().nonempty()
});

export const CreateOrderAdjustmentSchema = z.object({
	name: z.string().nonempty({ message: 'Name is required' }),
	amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/, { message: 'Enter a valid amount' })
});

export const SelectOrderAdjustmentSchema = CreateOrderAdjustmentSchema.extend({
	id: z.uuidv4().nonempty(),
	userId: z.uuidv4().nonempty(),
	orderId: z.uuidv4().nonempty()
});

export const DeleteOrderAdjustmentSchema = z.object({
	id: z.uuidv4().nonempty()
});

export const UpdateOrderAdjustmentSchema = CreateOrderAdjustmentSchema.partial().extend({
	id: z.uuidv4().nonempty()
});

export type CreateOrder = z.infer<typeof CreateOrderSchema>;
export type UpdateOrder = z.infer<typeof UpdateOrderSchema>;
export type SelectOrder = z.infer<typeof SelectOrderSchema>;
export type DeleteOrder = z.infer<typeof DeleteOrderSchema>;

export type CreateOrderItem = z.infer<typeof CreateOrderItemSchema>;
export type SelectOrderItem = z.infer<typeof SelectOrderItemSchema>;
export type DeleteOrderItem = z.infer<typeof DeleteOrderItemSchema>;

export type CreateOrderAdjustment = z.infer<typeof CreateOrderAdjustmentSchema>;
export type SelectOrderAdjustment = z.infer<typeof SelectOrderAdjustmentSchema>;
export type DeleteOrderAdjustment = z.infer<typeof DeleteOrderAdjustmentSchema>;
export type UpdateOrderAdjustment = z.infer<typeof UpdateOrderAdjustmentSchema>;

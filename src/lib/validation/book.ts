import { z } from 'zod/v4';

export const bookStatusEnum = z.enum(['Wishlist', 'Ordered', 'Owned']);
export const readStatusEnum = z.enum(['Not Read', 'Reading', 'Completed']);

export type BookStatus = z.infer<typeof bookStatusEnum>;
export type ReadStatus = z.infer<typeof readStatusEnum>;

export function isReadStatusAllowed(status: BookStatus, readStatus: ReadStatus): boolean {
	return status === 'Owned' || readStatus === 'Not Read';
}

const readStatusMismatch = {
	message: 'Read status must be "Not Read" unless the book is owned',
	path: ['readStatus']
};

const boughtAtField = z
	.string()
	.optional()
	.refine((val) => !val || /^\d{4}-(0[1-9]|1[0-2])$/.test(val), {
		message: 'Bought at must be a month in YYYY-MM format'
	});

/**
 * Self-hosted file id from the upload/import endpoints. Forms always submit
 * the hidden input, so '' (not undefined) means "no file" on create and
 * "clear the file" on update.
 */
const fileIdField = z.union([z.uuidv4(), z.literal('')]).optional();

const priceField = z
	.string()
	.optional()
	.refine((val) => !val || /^\d+(\.\d{1,2})?$/.test(val), { message: 'Enter a valid amount' });

function checkCurrencyPresent(val: {
	paidPrice?: string | undefined;
	originalPrice?: string | undefined;
	currencyCode?: string | undefined;
}): boolean {
	const hasPrice = Boolean(val.paidPrice?.trim() || val.originalPrice?.trim());
	return !hasPrice || Boolean(val.currencyCode?.trim());
}

export function parseBoughtAtMonth(value: string | null | undefined): Date | null | undefined {
	if (value == null) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(trimmed);
	if (!match) return undefined;
	return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

export function formatBoughtAtMonth(value: Date | string | null | undefined): string | undefined {
	if (!value) return undefined;
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return undefined;
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const base = z
	.object({
		volumeNumber: z.number().int().positive({ message: 'Volume must be a positive number' }),
		seriesId: z.uuidv4().nonempty({ message: 'Series is required' }),
		coverFileId: fileIdField,
		isbn: z.string().optional(),
		status: bookStatusEnum,
		readStatus: readStatusEnum,
		currencyCode: z
			.string()
			.trim()
			.refine((value) => value === '' || /^[A-Z]{3}$/.test(value), {
				message: 'Currency must be a three-letter uppercase ISO code'
			})
			.optional(),
		paidPrice: priceField,
		originalPrice: priceField,
		boughtAt: boughtAtField
	})
	.refine(checkCurrencyPresent, {
		message: 'Currency is required when a price is set',
		path: ['currencyCode']
	})
	.refine((val) => isReadStatusAllowed(val.status, val.readStatus), readStatusMismatch);

export const CreateBookSchema = base;

export const UpdateBookSchema = z
	.object({
		volumeNumber: z
			.number()
			.int()
			.positive({ message: 'Volume must be a positive number' })
			.optional(),
		seriesId: z.uuidv4().nonempty({ message: 'Series is required' }).optional(),
		coverFileId: fileIdField,
		isbn: z.string().optional(),
		status: bookStatusEnum.optional(),
		readStatus: readStatusEnum.optional(),
		currencyCode: z
			.string()
			.trim()
			.refine((value) => value === '' || /^[A-Z]{3}$/.test(value), {
				message: 'Currency must be a three-letter uppercase ISO code'
			})
			.optional(),
		paidPrice: priceField,
		originalPrice: priceField,
		boughtAt: boughtAtField,
		id: z.uuidv4().nonempty()
	})
	.refine(checkCurrencyPresent, {
		message: 'Currency is required when a price is set',
		path: ['currencyCode']
	})
	.refine(
		(val) =>
			val.status === undefined ||
			val.readStatus === undefined ||
			isReadStatusAllowed(val.status, val.readStatus),
		readStatusMismatch
	);

export const SelectBookSchema = base.extend({
	id: z.uuidv4().nonempty(),
	userId: z.uuidv4().nonempty()
});

export const UpdateBookStatusSchema = z.object({
	id: z.uuidv4().nonempty(),
	status: bookStatusEnum
});

export const UpdateBookReadStatusSchema = z.object({
	id: z.uuidv4().nonempty(),
	readStatus: readStatusEnum
});

export const DeleteBookSchema = z.object({
	id: z.uuidv4().nonempty()
});

export const UpdateBookBoughtAtSchema = z.object({
	id: z.uuidv4().nonempty(),
	boughtAt: boughtAtField
});

export type CreateBook = z.infer<typeof CreateBookSchema>;
export type UpdateBook = z.infer<typeof UpdateBookSchema>;
export type SelectBook = z.infer<typeof SelectBookSchema>;
export type UpdateBookStatus = z.infer<typeof UpdateBookStatusSchema>;
export type UpdateBookReadStatus = z.infer<typeof UpdateBookReadStatusSchema>;
export type DeleteBook = z.infer<typeof DeleteBookSchema>;
export type UpdateBookBoughtAt = z.infer<typeof UpdateBookBoughtAtSchema>;

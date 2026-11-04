import { z } from 'zod/v4';

export const bookStatusEnum = z.enum(['Wishlist', 'Ordered', 'Owned']);
export const readStatusEnum = z.enum(['Not Read', 'Reading', 'Completed']);

export type BookStatus = z.infer<typeof bookStatusEnum>;
export type ReadStatus = z.infer<typeof readStatusEnum>;

export function isReadStatusAllowed(status: BookStatus, readStatus: ReadStatus): boolean {
	return status === 'Owned' || readStatus === 'Not Read';
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whether the value is an existing calendar date in YYYY-MM-DD form.
 *
 * @param value - Trimmed date string.
 * @returns Whether the date exists.
 */
export function isValidReadingDate(value: string): boolean {
	const match = ISO_DATE_RE.exec(value);
	if (!match) return false;
	const [year, month, day] = match.slice(1).map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

function normalizeDateInput(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : undefined;
}

/**
 * Checks format and order of raw Started/Finished values. Either date may be omitted.
 *
 * @param startedAt - Raw Started value.
 * @param completedAt - Raw Finished value.
 * @returns Whether both are valid and Started is on or before Finished.
 */
export function isReadStartedCompletedAllowed(
	startedAt: string | undefined,
	completedAt: string | undefined
): boolean {
	const s = normalizeDateInput(startedAt);
	const c = normalizeDateInput(completedAt);
	if (s !== undefined && !isValidReadingDate(s)) return false;
	if (c !== undefined && !isValidReadingDate(c)) return false;
	if (s === undefined || c === undefined) return true;
	return s <= c;
}

const readStatusMismatch = {
	message: 'Read status must be "Not Read" unless the book is owned',
	path: ['readStatus']
};

const dateOrderMismatch = {
	message: 'Completed at must be on or after Started at',
	path: ['completedAt']
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

/** Form date field: undefined or empty means no date, otherwise YYYY-MM-DD. */
const readingDateField = z
	.string()
	.optional()
	.refine((val) => !val || isValidReadingDate(val.trim()), {
		message: 'Enter a valid date'
	});

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

/**
 * Converts a submitted Started/Finished value to its stored form. Empty becomes null.
 *
 * @param value - Raw Started/Finished value.
 * @returns The trimmed date, or null when unset.
 */
export function parseReadingDate(value: string | null | undefined): string | null {
	if (value == null) return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

const currencyCodeField = z
	.string()
	.trim()
	.refine((value) => value === '' || /^[A-Z]{3}$/.test(value), {
		message: 'Currency must be a three-letter uppercase ISO code'
	})
	.optional();

const progressFields = {
	startedAt: readingDateField,
	completedAt: readingDateField,
	readCount: z.int().min(0).max(32767).optional()
} as const;

const bookFields = {
	volumeNumber: z.number().int().positive({ message: 'Volume must be a positive number' }),
	coverFileId: fileIdField,
	isbn: z.string().optional(),
	status: bookStatusEnum,
	readStatus: readStatusEnum,
	currencyCode: currencyCodeField,
	paidPrice: priceField,
	originalPrice: priceField,
	boughtAt: boughtAtField,
	...progressFields
} as const;

/**
 * Fields the cross-field rules below inspect. Every book payload carries them.
 */
type BookProgressValues = {
	status: BookStatus;
	readStatus: ReadStatus;
	startedAt?: string | undefined;
	completedAt?: string | undefined;
	readCount?: number | undefined;
	currencyCode?: string | undefined;
	paidPrice?: string | undefined;
	originalPrice?: string | undefined;
};

/**
 * Cross-field rules shared by every book payload. Applied to the create, batch and
 * update schemas so the three can never drift apart.
 */
const progressRefinements = <T extends z.ZodType<BookProgressValues>>(schema: T): T =>
	schema
		.refine(checkCurrencyPresent, {
			message: 'Currency is required when a price is set',
			path: ['currencyCode']
		})
		.refine((val) => isReadStatusAllowed(val.status, val.readStatus), readStatusMismatch)
		.refine(
			(val) => isReadStartedCompletedAllowed(val.startedAt, val.completedAt),
			dateOrderMismatch
		);

const base = progressRefinements(
	z.object({
		seriesId: z.uuidv4().nonempty({ message: 'Series is required' }),
		...bookFields
	})
);

export const CreateBookSchema = base;

const batchBookSchema = progressRefinements(z.object(bookFields));

export const CreateBooksBatchSchema = z.object({
	seriesId: z.uuidv4().nonempty({ message: 'Series is required' }),
	books: z.array(batchBookSchema).min(1, { message: 'Add at least one volume' })
});

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
		currencyCode: currencyCodeField,
		paidPrice: priceField,
		originalPrice: priceField,
		boughtAt: boughtAtField,
		startedAt: readingDateField,
		completedAt: readingDateField,
		readCount: z.int().min(0).max(32767).optional(),
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
	)
	.refine(
		(val) =>
			val.startedAt === undefined ||
			val.completedAt === undefined ||
			isReadStartedCompletedAllowed(val.startedAt, val.completedAt),
		dateOrderMismatch
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

/** Partial progress update fired from the detail view as fields change. */
export const UpdateBookProgressSchema = z.object({
	id: z.uuidv4().nonempty(),
	startedAt: readingDateField,
	completedAt: readingDateField,
	readCount: z.int().min(0).max(32767).optional()
});

export const DeleteBookSchema = z.object({
	id: z.uuidv4().nonempty()
});

export const UpdateBookBoughtAtSchema = z.object({
	id: z.uuidv4().nonempty(),
	boughtAt: boughtAtField
});

export type CreateBook = z.infer<typeof CreateBookSchema>;
export type CreateBooksBatch = z.infer<typeof CreateBooksBatchSchema>;
export type UpdateBook = z.infer<typeof UpdateBookSchema>;
export type SelectBook = z.infer<typeof SelectBookSchema>;
export type UpdateBookStatus = z.infer<typeof UpdateBookStatusSchema>;
export type UpdateBookReadStatus = z.infer<typeof UpdateBookReadStatusSchema>;
export type DeleteBook = z.infer<typeof DeleteBookSchema>;
export type UpdateBookBoughtAt = z.infer<typeof UpdateBookBoughtAtSchema>;

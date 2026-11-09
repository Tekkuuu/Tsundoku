import { z } from 'zod/v4';

export const seriesStatusEnum = z.enum(['Ongoing', 'Completed', 'Hiatus', 'Cancelled']);

const titleField = z.string().nonempty({ message: 'This field cannot be empty' });
const authorField = z.string().optional();

const base = z.object({
	title: titleField,
	author: authorField,
	status: seriesStatusEnum,
	genres: z.array(z.uuidv4()).default([])
});

export const CreateSeriesSchema = base;

const batchRow = z.object({
	title: titleField,
	author: authorField,
	status: seriesStatusEnum,
	/** Raw comma-separated genre names, resolved server-side inside the batch transaction. */
	genres: z.string().default('')
});

export const CreateSeriesBatchSchema = z.object({
	series: z.array(batchRow).min(1, { message: 'Add at least one series' })
});

/** Genre changes are delta-based; omitted lists are no-ops. */
export const UpdateSeriesSchema = z.object({
	id: z.uuidv4().nonempty(),
	title: titleField.optional(),
	author: authorField,
	status: seriesStatusEnum.optional(),
	addGenres: z.array(z.uuidv4()).optional(),
	removeGenres: z.array(z.uuidv4()).optional()
});

export const SelectSeriesSchema = base.extend({
	id: z.uuidv4().nonempty(),
	userId: z.uuidv4().nonempty()
});

export const UpdateSeriesStatusSchema = z.object({
	id: z.uuidv4(),
	status: seriesStatusEnum
});

export const DeleteSeriesSchema = z.object({
	id: z.uuidv4()
});

export type SeriesGenre = { id: string; name: string };

export type CreateSeries = z.infer<typeof CreateSeriesSchema>;
export type CreateSeriesBatch = z.infer<typeof CreateSeriesBatchSchema>;
export type UpdateSeries = z.infer<typeof UpdateSeriesSchema>;
export type SelectSeries = z.infer<typeof SelectSeriesSchema>;
export type UpdateSeriesStatus = z.infer<typeof UpdateSeriesStatusSchema>;
export type DeleteSeries = z.infer<typeof DeleteSeriesSchema>;

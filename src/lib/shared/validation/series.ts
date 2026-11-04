import { z } from 'zod/v4';

export const seriesStatusEnum = z.enum(['Ongoing', 'Completed', 'Hiatus', 'Cancelled']);

const base = z.object({
	title: z.string().nonempty({ message: 'This field cannot be empty' }),
	author: z.string().optional(),
	status: seriesStatusEnum
});

export const CreateSeriesSchema = base;

export const CreateSeriesBatchSchema = z.object({
	series: z.array(base).min(1, { message: 'Add at least one series' })
});

export const UpdateSeriesSchema = base.partial().extend({
	id: z.uuidv4().nonempty()
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

export type CreateSeries = z.infer<typeof CreateSeriesSchema>;
export type CreateSeriesBatch = z.infer<typeof CreateSeriesBatchSchema>;
export type UpdateSeries = z.infer<typeof UpdateSeriesSchema>;
export type SelectSeries = z.infer<typeof SelectSeriesSchema>;
export type UpdateSeriesStatus = z.infer<typeof UpdateSeriesStatusSchema>;
export type DeleteSeries = z.infer<typeof DeleteSeriesSchema>;

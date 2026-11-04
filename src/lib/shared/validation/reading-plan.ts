import { z } from 'zod/v4';
import { isValidReadingDate } from './book';

const plannedDateField = z
	.string()
	.trim()
	.refine((value) => isValidReadingDate(value), {
		message: 'Enter a valid date'
	});

export const ScheduleReadingSchema = z.object({
	bookId: z.uuidv4().nonempty(),
	plannedDate: plannedDateField
});

export const UnscheduleReadingSchema = z.object({
	id: z.uuidv4().nonempty()
});

export type ScheduleReading = z.infer<typeof ScheduleReadingSchema>;
export type UnscheduleReading = z.infer<typeof UnscheduleReadingSchema>;

import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { and, asc, eq, isNotNull, ne } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { book, readingPlanItem, series } from '#lib/server/db/schema.js';
import { logger } from '#lib/server/logger.js';
import {
	ScheduleReadingSchema,
	UnscheduleReadingSchema
} from '#lib/shared/validation/reading-plan.js';

export type CalendarCompletedRead = {
	bookId: string;
	seriesId: string;
	seriesTitle: string;
	volumeNumber: number;
	completedAt: string;
};

export type CalendarRemainingVolume = {
	bookId: string;
	seriesId: string;
	seriesTitle: string;
	author: string | null;
	volumeNumber: number;
};

export type CalendarPlannedRead = CalendarRemainingVolume & {
	id: string;
	plannedDate: string;
};

export type ReadingCalendarData = {
	completed: CalendarCompletedRead[];
	remaining: CalendarRemainingVolume[];
	planned: CalendarPlannedRead[];
};

export const getReadingCalendar = query(async (): Promise<ReadingCalendarData> => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized reading calendar select');
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;

	const [completedRows, remainingRows, plannedRows] = await Promise.all([
		db
			.select({
				bookId: book.id,
				seriesId: series.id,
				seriesTitle: series.title,
				volumeNumber: book.volumeNumber,
				completedAt: book.completedAt
			})
			.from(book)
			.innerJoin(series, eq(series.id, book.seriesId))
			.where(and(eq(book.userId, userId), isNotNull(book.completedAt)))
			.orderBy(asc(book.completedAt)),
		db
			.select({
				bookId: book.id,
				seriesId: series.id,
				seriesTitle: series.title,
				author: series.author,
				volumeNumber: book.volumeNumber
			})
			.from(book)
			.innerJoin(series, eq(series.id, book.seriesId))
			.where(
				and(eq(book.userId, userId), eq(book.status, 'Owned'), ne(book.readStatus, 'Completed'))
			)
			.orderBy(asc(series.title), asc(book.volumeNumber)),
		db
			.select({
				id: readingPlanItem.id,
				bookId: book.id,
				seriesId: series.id,
				seriesTitle: series.title,
				author: series.author,
				volumeNumber: book.volumeNumber,
				plannedDate: readingPlanItem.plannedDate
			})
			.from(readingPlanItem)
			.innerJoin(book, eq(book.id, readingPlanItem.bookId))
			.innerJoin(series, eq(series.id, book.seriesId))
			.where(
				and(
					eq(readingPlanItem.userId, userId),
					eq(book.userId, userId),
					eq(book.status, 'Owned'),
					ne(book.readStatus, 'Completed')
				)
			)
			.orderBy(asc(readingPlanItem.plannedDate), asc(series.title), asc(book.volumeNumber))
	]);

	return {
		completed: completedRows.flatMap((row) =>
			row.completedAt === null ? [] : [{ ...row, completedAt: row.completedAt }]
		),
		remaining: remainingRows,
		planned: plannedRows
	};
});

export const scheduleReading = command(ScheduleReadingSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized reading plan insert');
		error(401, 'Unauthorized');
	}

	const userId = locals.user.id;

	const target = await db.query.book.findFirst({
		columns: { status: true, readStatus: true },
		where: and(eq(book.id, data.bookId), eq(book.userId, userId))
	});

	if (!target) {
		logger.warn({ userId, bookId: data.bookId }, 'Book not found for reading plan');
		error(404, 'Book not found');
	}

	if (target.status !== 'Owned' || target.readStatus === 'Completed') {
		logger.warn(
			{ userId, bookId: data.bookId },
			'Attempt to schedule an unowned or completed book'
		);
		error(409, 'Only owned, unfinished volumes can be scheduled');
	}

	await db
		.insert(readingPlanItem)
		.values({
			userId,
			bookId: data.bookId,
			plannedDate: data.plannedDate
		})
		.onConflictDoUpdate({
			target: [readingPlanItem.userId, readingPlanItem.bookId],
			set: { plannedDate: data.plannedDate }
		});
});

export const unscheduleReading = command(UnscheduleReadingSchema, async (data) => {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		logger.warn('Unauthorized reading plan delete');
		error(401, 'Unauthorized');
	}

	await db
		.delete(readingPlanItem)
		.where(and(eq(readingPlanItem.id, data.id), eq(readingPlanItem.userId, locals.user.id)));
});

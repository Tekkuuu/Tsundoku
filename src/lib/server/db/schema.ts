import { relations, sql } from 'drizzle-orm';
import {
	pgTable,
	text,
	timestamp,
	integer,
	numeric,
	uuid,
	index,
	unique,
	uniqueIndex,
	check,
	pgEnum,
	smallint,
	date,
	primaryKey
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

export const seriesStatusEnum = pgEnum('series_status', [
	'Ongoing',
	'Completed',
	'Hiatus',
	'Cancelled'
]);
export const bookStatusEnum = pgEnum('book_status', ['Wishlist', 'Ordered', 'Owned']);
export const readStatusEnum = pgEnum('read_status', ['Not Read', 'Reading', 'Completed']);
export const fileKindEnum = pgEnum('file_kind', ['cover', 'receipt']);

export const file = pgTable(
	'file',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: fileKindEnum('kind').notNull(),
		contentType: text('content_type').notNull(),
		size: integer('size').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('file_userId_idx').on(table.userId)]
);

export const series = pgTable(
	'series',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		author: text('author'),
		status: seriesStatusEnum('status').notNull().default('Ongoing')
	},
	(table) => [
		index('series_userId_idx').on(table.userId),
		index('series_author_idx').on(table.author),
		uniqueIndex('unique_user_series_title_author').on(
			table.userId,
			sql`lower(btrim(${table.title}))`,
			sql`lower(btrim(coalesce(${table.author}, '')))`
		),
		index('series_title_trgm_idx').using('gin', sql`${table.title} gin_trgm_ops`),
		index('series_author_trgm_idx').using('gin', sql`${table.author} gin_trgm_ops`)
	]
);

export const genre = pgTable(
	'genre',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull()
	},
	(table) => [
		uniqueIndex('unique_user_genre').on(table.userId, sql`lower(btrim(${table.name}))`),
		index('genre_name_trgm_idx').using('gin', sql`${table.name} gin_trgm_ops`)
	]
);

export const seriesGenre = pgTable(
	'series_genre',
	{
		genreId: uuid('genre_id')
			.notNull()
			.references(() => genre.id, { onDelete: 'cascade' }),
		seriesId: uuid('series_id')
			.notNull()
			.references(() => series.id, { onDelete: 'cascade' })
	},
	(table) => [
		primaryKey({ columns: [table.seriesId, table.genreId] }),
		index('seriesGenre_genreId_idx').on(table.genreId)
	]
);

export const book = pgTable(
	'book',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		seriesId: uuid('series_id')
			.notNull()
			.references(() => series.id, { onDelete: 'cascade' }),
		volumeNumber: integer('volume_number').notNull(),
		coverFileId: uuid('cover_file_id').references(() => file.id, { onDelete: 'set null' }),
		isbn: text('isbn'),
		status: bookStatusEnum('status').notNull().default('Owned'),
		readStatus: readStatusEnum('read_status').notNull().default('Not Read'),
		currencyCode: text('currency_code'),
		paidPrice: numeric('paid_price', { precision: 10, scale: 2 }),
		originalPrice: numeric('original_price', { precision: 10, scale: 2 }),
		boughtAt: timestamp('bought_at'),
		startedAt: date('started_at', { mode: 'string' }),
		completedAt: date('completed_at', { mode: 'string' }),
		readCount: smallint('read_count').notNull().default(0)
	},
	(table) => [
		index('book_userId_idx').on(table.userId),
		index('book_seriesId_idx').on(table.seriesId),
		index('book_user_series_volume_idx').on(table.userId, table.seriesId, table.volumeNumber),
		unique('unique_user_series_volume').on(table.userId, table.seriesId, table.volumeNumber),
		check(
			'book_read_status_owned_check',
			sql`${table.status} = 'Owned' OR ${table.readStatus} = 'Not Read'`
		),
		check('read_count_is_nonnegative_check', sql`${table.readCount} >= 0`),
		check(
			'started_at_before_completed_at',
			sql`${table.completedAt} IS NULL OR ${table.startedAt} <= ${table.completedAt}`
		)
	]
);

export const readingPlanItem = pgTable(
	'reading_plan_item',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		bookId: uuid('book_id')
			.notNull()
			.references(() => book.id, { onDelete: 'cascade' }),
		plannedDate: date('planned_date', { mode: 'string' }).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('readingPlanItem_userId_idx').on(table.userId),
		index('readingPlanItem_bookId_idx').on(table.bookId),
		index('readingPlanItem_user_date_idx').on(table.userId, table.plannedDate),
		unique('unique_user_planned_book').on(table.userId, table.bookId)
	]
);

export const order = pgTable(
	'order',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		orderNumber: text('order_number'),
		storeName: text('store_name').notNull(),
		orderDate: timestamp('order_date').defaultNow().notNull(),
		currencyCode: text('currency_code').notNull(),
		receiptFileId: uuid('receipt_file_id').references(() => file.id, { onDelete: 'set null' }),
		note: text('note')
	},
	(table) => [
		index('order_userId_idx').on(table.userId),
		index('order_userId_orderDate_idx').on(table.userId, table.orderDate.desc(), table.id.desc()),
		index('order_storeName_idx').on(table.storeName),
		index('order_orderNumber_idx').on(table.orderNumber),
		index('order_orderNumber_trgm_idx').using('gin', sql`${table.orderNumber} gin_trgm_ops`),
		index('order_storeName_trgm_idx').using('gin', sql`${table.storeName} gin_trgm_ops`),
		index('order_note_trgm_idx').using('gin', sql`${table.note} gin_trgm_ops`)
	]
);

export const orderItem = pgTable(
	'order_item',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		orderId: uuid('order_id')
			.notNull()
			.references(() => order.id, { onDelete: 'cascade' }),
		bookId: uuid('book_id')
			.notNull()
			.references(() => book.id, { onDelete: 'cascade' })
	},
	(table) => [
		index('orderItem_userId_idx').on(table.userId),
		index('orderItem_orderId_idx').on(table.orderId),
		index('orderItem_bookId_idx').on(table.bookId),
		unique('unique_book_order').on(table.bookId)
	]
);

export const orderAdjustment = pgTable(
	'order_adjustment',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		orderId: uuid('order_id')
			.notNull()
			.references(() => order.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		amount: numeric('amount', { precision: 10, scale: 2 }).notNull()
	},
	(table) => [
		index('orderAdjustment_userId_idx').on(table.userId),
		index('orderAdjustment_orderId_idx').on(table.orderId)
	]
);

// ============================================================================
// RELATIONS
// ============================================================================

export const seriesRelations = relations(series, ({ one, many }) => ({
	user: one(user, { fields: [series.userId], references: [user.id] }),
	books: many(book),
	seriesGenre: many(seriesGenre)
}));

export const fileRelations = relations(file, ({ one }) => ({
	user: one(user, { fields: [file.userId], references: [user.id] })
}));

export const bookRelations = relations(book, ({ one, many }) => ({
	user: one(user, { fields: [book.userId], references: [user.id] }),
	series: one(series, { fields: [book.seriesId], references: [series.id] }),
	coverFile: one(file, { fields: [book.coverFileId], references: [file.id] }),
	orderItem: one(orderItem),
	planItems: many(readingPlanItem)
}));

export const readingPlanItemRelations = relations(readingPlanItem, ({ one }) => ({
	user: one(user, { fields: [readingPlanItem.userId], references: [user.id] }),
	book: one(book, { fields: [readingPlanItem.bookId], references: [book.id] })
}));

export const orderRelations = relations(order, ({ one, many }) => ({
	user: one(user, { fields: [order.userId], references: [user.id] }),
	receiptFile: one(file, { fields: [order.receiptFileId], references: [file.id] }),
	items: many(orderItem),
	adjustments: many(orderAdjustment)
}));

export const orderItemRelations = relations(orderItem, ({ one }) => ({
	user: one(user, { fields: [orderItem.userId], references: [user.id] }),
	order: one(order, { fields: [orderItem.orderId], references: [order.id] }),
	book: one(book, { fields: [orderItem.bookId], references: [book.id] })
}));

export const orderAdjustmentRelations = relations(orderAdjustment, ({ one }) => ({
	user: one(user, { fields: [orderAdjustment.userId], references: [user.id] }),
	order: one(order, { fields: [orderAdjustment.orderId], references: [order.id] })
}));

export const genreRelations = relations(genre, ({ one, many }) => ({
	user: one(user, { fields: [genre.userId], references: [user.id] }),
	seriesGenre: many(seriesGenre)
}));

export const seriesGenreRelations = relations(seriesGenre, ({ one }) => ({
	series: one(series, { fields: [seriesGenre.seriesId], references: [series.id] }),
	genre: one(genre, { fields: [seriesGenre.genreId], references: [genre.id] })
}));

export * from './auth.schema';

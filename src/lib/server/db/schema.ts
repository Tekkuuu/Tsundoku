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
	check,
	pgEnum
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
		index('series_author_idx').on(table.author)
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
		boughtAt: timestamp('bought_at')
	},
	(table) => [
		index('book_userId_idx').on(table.userId),
		index('book_seriesId_idx').on(table.seriesId),
		index('book_user_series_volume_idx').on(table.userId, table.seriesId, table.volumeNumber),
		unique('unique_user_series_volume').on(table.userId, table.seriesId, table.volumeNumber),
		check(
			'book_read_status_owned_check',
			sql`${table.status} = 'Owned' OR ${table.readStatus} = 'Not Read'`
		)
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
		receiptUrl: text('receipt_url'),
		receiptFileId: uuid('receipt_file_id').references(() => file.id, { onDelete: 'set null' }),
		note: text('note')
	},
	(table) => [
		index('order_userId_idx').on(table.userId),
		index('order_storeName_idx').on(table.storeName),
		index('order_orderNumber_idx').on(table.orderNumber)
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
	books: many(book)
}));

export const fileRelations = relations(file, ({ one }) => ({
	user: one(user, { fields: [file.userId], references: [user.id] })
}));

export const bookRelations = relations(book, ({ one }) => ({
	user: one(user, { fields: [book.userId], references: [user.id] }),
	series: one(series, { fields: [book.seriesId], references: [series.id] }),
	coverFile: one(file, { fields: [book.coverFileId], references: [file.id] }),
	orderItem: one(orderItem)
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

export * from './auth.schema';

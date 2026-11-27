import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  timestamp,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const inventory = pgTable(
  'inventory',
  {
    productId: varchar('product_id', {
      length: 100,
    }).primaryKey(),

    stock: integer('stock').notNull(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [check('stock_non_negative', sql`${table.stock} >= 0`)],
);

export const reservationStatus = pgEnum('reservation_status', [
  'RESERVED',
  'RELEASED',
]);

export const reservations = pgTable(
  'reservations',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    orderId: uuid('order_id').notNull().unique(),

    productId: varchar('product_id', {
      length: 100,
    })
      .notNull()
      .references(() => inventory.productId),

    quantity: integer('quantity').notNull(),

    status: reservationStatus('status').default('RESERVED').notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [check('quantity_positive', sql`${table.quantity} > 0`)],
);

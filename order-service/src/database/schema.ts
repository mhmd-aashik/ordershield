import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';

export const orderStatus = pgEnum('order_status', [
  'PENDING',
  'INVENTORY_RESERVED',
  'PAYMENT_COMPLETED',
  'CONFIRMED',
  'COMPENSATING',
  'CANCELLED',
]);

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),

  productId: varchar('product_id', {
    length: 100,
  }).notNull(),

  quantity: integer('quantity').notNull(),

  amount: integer('amount').notNull(),

  status: orderStatus('status').default('PENDING').notNull(),

  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp('updated_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

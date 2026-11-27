import {
  pgTable,
  pgEnum,
  uuid,
  integer,
  timestamp,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const paymentStatus = pgEnum('payment_status', [
  'COMPLETED',
  'FAILED',
  'REFUNDED',
]);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    orderId: uuid('order_id').notNull().unique(),

    amount: integer('amount').notNull(),

    status: paymentStatus('status').notNull(),

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
  },
  (table) => [check('amount_positive', sql`${table.amount} > 0`)],
);

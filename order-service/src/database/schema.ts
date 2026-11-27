import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
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

  idempotencyKey: varchar('idempotency_key', {
    length: 128,
  }).unique(),

  requestHash: varchar('request_hash', {
    length: 64,
  }),

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

export const sagaStep = pgEnum('saga_step', [
  'STARTED',
  'RESERVING_INVENTORY',
  'INVENTORY_RESERVED',
  'PROCESSING_PAYMENT',
  'PAYMENT_COMPLETED',
  'RELEASING_INVENTORY',
  'COMPLETED',
  'COMPENSATED',
  'FAILED',
]);

export const sagaInstances = pgTable('saga_instances', {
  id: uuid('id').defaultRandom().primaryKey(),

  orderId: uuid('order_id')
    .notNull()
    .unique()
    .references(() => orders.id),

  step: sagaStep('step').default('STARTED').notNull(),

  reservationId: uuid('reservation_id'),

  paymentId: uuid('payment_id'),

  lastError: text('last_error'),

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

import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { createHash } from 'node:crypto';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.module.js';
import * as schema from '../database/schema.js';

import { OrderSagaService } from './saga/order-saga.service.js';

type CreateOrderRequest = {
  productId: string;
  quantity: number;
  amount: number;
  idempotencyKey: string;
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DATABASE)
    private readonly db: NodePgDatabase<typeof schema>,

    private readonly sagaService: OrderSagaService,
  ) {}

  async create(data: CreateOrderRequest) {
    // 1. Validate idempotency key
    if (
      typeof data.idempotencyKey !== 'string' ||
      !data.idempotencyKey.trim() ||
      data.idempotencyKey.length > 128
    ) {
      throw new BadRequestException('Invalid idempotency key');
    }

    // 2. Generate request hash
    const requestHash = this.generateRequestHash(data);

    // 3. Atomic database transaction
    const result = await this.db.transaction(async (tx) => {
      const [newOrder] = await tx
        .insert(schema.orders)
        .values({
          productId: data.productId,
          quantity: data.quantity,
          amount: data.amount,
          idempotencyKey: data.idempotencyKey,
          requestHash,
          status: 'PENDING',
        })
        .onConflictDoNothing({
          target: schema.orders.idempotencyKey,
        })
        .returning();

      // 4. New order
      if (newOrder) {
        await tx.insert(schema.sagaInstances).values({
          orderId: newOrder.id,
          step: 'STARTED',
        });

        return {
          order: newOrder,
          isNew: true,
        };
      }

      // 5. Existing order
      const [existingOrder] = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.idempotencyKey, data.idempotencyKey));

      if (!existingOrder) {
        throw new ServiceUnavailableException(
          'Unable to retrieve existing order',
        );
      }

      // 6. Detect changed request payload
      if (existingOrder.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency key already used with a different request',
        );
      }

      return {
        order: existingOrder,
        isNew: false,
      };
    });

    // 7. Duplicate request
    if (!result.isNew) {
      return result.order;
    }

    // 8. Execute Saga only for a new order
    return this.sagaService.execute(result.order);
  }

  private generateRequestHash(data: CreateOrderRequest): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          productId: data.productId,
          quantity: data.quantity,
          amount: data.amount,
        }),
      )
      .digest('hex');
  }

  async findAll() {
    return this.db.select().from(schema.orders);
  }
}

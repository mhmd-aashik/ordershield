import { Injectable, Inject } from '@nestjs/common';

import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DATABASE } from '../database/database.module.js';
import * as schema from '../database/schema.js';
import { OrderSagaService } from './saga/order-saga.service.js';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DATABASE)
    private readonly db: NodePgDatabase<typeof schema>,

    private readonly sagaService: OrderSagaService,
  ) {}

  async create(data: { productId: string; quantity: number; amount: number }) {
    const order = await this.db.transaction(async (tx) => {
      const [order] = await tx
        .insert(schema.orders)
        .values({
          ...data,
          status: 'PENDING',
        })
        .returning();

      await tx.insert(schema.sagaInstances).values({
        orderId: order.id,
        step: 'STARTED',
      });

      return order;
    });

    return this.sagaService.execute(order);
  }

  async findAll() {
    return this.db.select().from(schema.orders);
  }
}

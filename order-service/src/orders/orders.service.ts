import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE } from '../database/database.module.js';
import * as schema from '../database/schema.js';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DATABASE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: { productId: string; quantity: number; amount: number }) {
    const [order] = await this.db
      .insert(schema.orders)
      .values({
        ...data,
        status: 'PENDING',
      })
      .returning();

    return order;
  }

  async findAll() {
    return this.db.select().from(schema.orders);
  }
}

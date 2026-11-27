// import { Inject, Injectable } from '@nestjs/common';
// import { NodePgDatabase } from 'drizzle-orm/node-postgres';
// import { DATABASE } from '../database/database.module.js';
// import * as schema from '../database/schema.js';

// @Injectable()
// export class OrdersService {
//   constructor(
//     @Inject(DATABASE)
//     private readonly db: NodePgDatabase<typeof schema>,
//   ) {}

//   async create(data: { productId: string; quantity: number; amount: number }) {
//     const [order] = await this.db
//       .insert(schema.orders)
//       .values({
//         ...data,
//         status: 'PENDING',
//       })
//       .returning();

//     return order;
//   }

//   async findAll() {
//     return this.db.select().from(schema.orders);
//   }
// }

import {
  Injectable,
  Inject,
  OnModuleInit,
  Logger,
  ConflictException,
} from '@nestjs/common';

import type { ClientGrpc } from '@nestjs/microservices';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { firstValueFrom, timeout } from 'rxjs';

import { DATABASE } from '../database/database.module.js';
import * as schema from '../database/schema.js';

import {
  InventoryGrpcService,
  PaymentGrpcService,
} from '../clients/grpc.interfaces.js';

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  private inventoryService!: InventoryGrpcService;
  private paymentService!: PaymentGrpcService;

  constructor(
    @Inject(DATABASE)
    private readonly db: NodePgDatabase<typeof schema>,

    @Inject('INVENTORY_SERVICE')
    private readonly inventoryClient: ClientGrpc,

    @Inject('PAYMENT_SERVICE')
    private readonly paymentClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.inventoryService =
      this.inventoryClient.getService<InventoryGrpcService>('InventoryService');

    this.paymentService =
      this.paymentClient.getService<PaymentGrpcService>('PaymentService');
  }

  async create(data: { productId: string; quantity: number; amount: number }) {
    // Step 1: Create order
    const [order] = await this.db
      .insert(schema.orders)
      .values({
        ...data,
        status: 'PENDING',
      })
      .returning();

    this.logger.log(`Order created: ${order.id}`);

    // Step 2: Reserve inventory
    const reservation = await firstValueFrom(
      this.inventoryService
        .reserveStock({
          orderId: order.id,
          productId: order.productId,
          quantity: order.quantity,
        })
        .pipe(timeout(5000)),
    );

    this.logger.log(`Inventory reserved: ${reservation.reservationId}`);

    await this.updateStatus(order.id, 'INVENTORY_RESERVED');

    // Step 3: Process payment
    const payment = await firstValueFrom(
      this.paymentService
        .charge({
          orderId: order.id,
          amount: order.amount,
        })
        .pipe(timeout(5000)),
    );

    if (payment.status !== 'COMPLETED') {
      this.logger.error(`Payment failed for order: ${order.id}`);

      // Intentionally missing compensation
      throw new ConflictException('Payment failed');
    }

    await this.updateStatus(order.id, 'PAYMENT_COMPLETED');

    // Step 4: Confirm order
    const confirmedOrder = await this.updateStatus(order.id, 'CONFIRMED');

    this.logger.log(`Order confirmed: ${order.id}`);

    return confirmedOrder;
  }

  private async updateStatus(
    orderId: string,
    status: (typeof schema.orderStatus.enumValues)[number],
  ) {
    const [order] = await this.db
      .update(schema.orders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId))
      .returning();

    return order;
  }

  async findAll() {
    return this.db.select().from(schema.orders);
  }
}

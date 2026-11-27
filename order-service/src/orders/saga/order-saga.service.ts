import {
  Injectable,
  Inject,
  OnModuleInit,
  Logger,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { ClientGrpc } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { firstValueFrom, timeout } from 'rxjs';

import { DATABASE } from '../../database/database.module.js';
import * as schema from '../../database/schema.js';

import {
  InventoryGrpcService,
  PaymentGrpcService,
} from '../../clients/grpc.interfaces.js';

type Order = typeof schema.orders.$inferSelect;
type OrderStatus = Order['status'];

@Injectable()
export class OrderSagaService implements OnModuleInit {
  private readonly logger = new Logger(OrderSagaService.name);

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

  async execute(order: Order) {
    this.logger.log(`Saga started: ${order.id}`);

    // Step 1: Reserve inventory
    let reservation: {
      success: boolean;
      reservationId: string;
      remainingStock: number;
    };

    try {
      reservation = await firstValueFrom(
        this.inventoryService
          .reserveStock({
            orderId: order.id,
            productId: order.productId,
            quantity: order.quantity,
          })
          .pipe(timeout(5000)),
      );
    } catch (error) {
      const code = (error as { code?: number }).code;

      if (code === status.FAILED_PRECONDITION) {
        await this.updateStatus(order.id, 'CANCELLED');

        throw new ConflictException('Inventory reservation rejected');
      }

      this.logger.error(`Inventory outcome uncertain: ${order.id}`);

      throw new ServiceUnavailableException(
        'Inventory outcome requires reconciliation',
      );
    }

    if (!reservation.success || !reservation.reservationId) {
      throw new ServiceUnavailableException(
        'Reservation outcome requires reconciliation',
      );
    }

    await this.updateStatus(order.id, 'INVENTORY_RESERVED');

    this.logger.log(`Inventory reserved: ${reservation.reservationId}`);

    // Step 2: Process payment
    let payment;

    try {
      payment = await firstValueFrom(
        this.paymentService
          .charge({
            orderId: order.id,
            amount: order.amount,
          })
          .pipe(timeout(5000)),
      );
    } catch {
      this.logger.error(`Payment outcome uncertain: ${order.id}`);

      // Do not compensate blindly.
      // The payment might already have succeeded.
      throw new ServiceUnavailableException(
        'Payment outcome requires reconciliation',
      );
    }

    // Step 3: Handle definitive payment failure
    if (payment.status === 'FAILED') {
      await this.compensateInventory(order.id, reservation.reservationId);

      throw new ConflictException('Payment declined. Order cancelled.');
    }

    if (payment.status !== 'COMPLETED') {
      throw new ServiceUnavailableException('Unexpected payment state');
    }

    await this.updateStatus(order.id, 'PAYMENT_COMPLETED');

    // Step 4: Confirm order
    const confirmedOrder = await this.updateStatus(order.id, 'CONFIRMED');

    this.logger.log(`Saga completed: ${order.id}`);

    return confirmedOrder;
  }

  private async compensateInventory(orderId: string, reservationId: string) {
    this.logger.warn(`Compensation started: ${orderId}`);

    await this.updateStatus(orderId, 'COMPENSATING');

    try {
      const result = await firstValueFrom(
        this.inventoryService
          .releaseStock({
            reservationId,
          })
          .pipe(timeout(5000)),
      );

      if (!result.success) {
        throw new Error('Inventory release failed');
      }

      await this.updateStatus(orderId, 'CANCELLED');

      this.logger.log(`Compensation completed: ${orderId}`);
    } catch {
      this.logger.error(`Compensation incomplete: ${orderId}`);

      throw new ServiceUnavailableException('Compensation requires recovery');
    }
  }

  private async updateStatus(orderId: string, status: OrderStatus) {
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
}

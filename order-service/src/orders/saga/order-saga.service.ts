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
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { firstValueFrom, timeout } from 'rxjs';

import { DATABASE } from '../../database/database.module.js';
import * as schema from '../../database/schema.js';

import type {
  InventoryGrpcService,
  PaymentGrpcService,
  PaymentResponse,
} from '../../clients/grpc.interfaces.js';

type Order = typeof schema.orders.$inferSelect;
type OrderStatus = Order['status'];

type SagaInstance = typeof schema.sagaInstances.$inferSelect;

type SagaStep = SagaInstance['step'];

type SagaData = {
  reservationId?: string;
  paymentId?: string;
  lastError?: string | null;
};

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

  // ==========================================
  // 1. EXECUTE SAGA
  // ==========================================

  async execute(order: Order) {
    this.logger.log(`Saga started: ${order.id}`);

    let reservation: {
      success: boolean;
      reservationId: string;
      remainingStock: number;
    };

    await this.updateSaga(order.id, 'RESERVING_INVENTORY');

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
        await this.checkpoint(order.id, 'FAILED', 'CANCELLED', {
          lastError: 'Inventory reservation rejected',
        });

        throw new ConflictException('Inventory reservation rejected');
      }

      await this.updateSaga(order.id, 'RESERVING_INVENTORY', {
        lastError: 'Inventory outcome uncertain',
      });

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

    await this.checkpoint(
      order.id,
      'INVENTORY_RESERVED',
      'INVENTORY_RESERVED',
      {
        reservationId: reservation.reservationId,
        lastError: null,
      },
    );

    this.logger.log(`Inventory reserved: ${reservation.reservationId}`);

    // Development-only crash simulation
    if (process.env.SIMULATE_SAGA_CRASH === 'true') {
      this.logger.error('Simulating orchestrator crash');

      process.exit(1);
    }

    return this.processPayment(order, reservation.reservationId);
  }

  // ==========================================
  // 2. PROCESS PAYMENT
  // ==========================================

  private async processPayment(order: Order, reservationId: string) {
    await this.updateSaga(order.id, 'PROCESSING_PAYMENT');

    let payment: PaymentResponse;

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
      await this.updateSaga(order.id, 'PROCESSING_PAYMENT', {
        lastError: 'Payment outcome uncertain',
      });

      this.logger.error(`Payment outcome uncertain: ${order.id}`);

      throw new ServiceUnavailableException(
        'Payment outcome requires reconciliation',
      );
    }

    if (payment.status === 'FAILED') {
      await this.compensateInventory(order.id, reservationId);

      throw new ConflictException('Payment declined. Order cancelled.');
    }

    if (payment.status !== 'COMPLETED') {
      throw new ServiceUnavailableException('Unexpected payment state');
    }

    await this.checkpoint(order.id, 'PAYMENT_COMPLETED', 'PAYMENT_COMPLETED', {
      paymentId: payment.id,
      lastError: null,
    });

    const confirmedOrder = await this.checkpoint(
      order.id,
      'COMPLETED',
      'CONFIRMED',
    );

    this.logger.log(`Saga completed: ${order.id}`);

    return confirmedOrder;
  }

  // ==========================================
  // 3. COMPENSATE INVENTORY
  // ==========================================

  private async compensateInventory(orderId: string, reservationId: string) {
    this.logger.warn(`Compensation started: ${orderId}`);

    await this.checkpoint(orderId, 'RELEASING_INVENTORY', 'COMPENSATING', {
      reservationId,
      lastError: 'Payment declined',
    });

    try {
      const result = await firstValueFrom(
        this.inventoryService
          .releaseStock({ reservationId })
          .pipe(timeout(5000)),
      );

      if (!result.success) {
        throw new Error('Inventory release failed');
      }
    } catch {
      await this.updateSaga(orderId, 'RELEASING_INVENTORY', {
        lastError: 'Compensation incomplete',
      });

      this.logger.error(`Compensation incomplete: ${orderId}`);

      throw new ServiceUnavailableException('Compensation requires recovery');
    }

    const cancelledOrder = await this.checkpoint(
      orderId,
      'COMPENSATED',
      'CANCELLED',
      {
        lastError: 'Payment declined',
      },
    );

    this.logger.log(`Compensation completed: ${orderId}`);

    return cancelledOrder;
  }

  // ==========================================
  // 4. RESUME INTERRUPTED SAGA
  // ==========================================

  async resume(saga: SagaInstance) {
    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, saga.orderId));

    if (!order) {
      throw new Error('Order not found');
    }

    this.logger.log(`Resuming saga ${saga.id} from ${saga.step}`);

    switch (saga.step) {
      case 'STARTED':
        return this.execute(order);

      case 'INVENTORY_RESERVED':
      case 'PROCESSING_PAYMENT': {
        if (!saga.reservationId) {
          throw new Error('Reservation ID missing');
        }

        return this.processPayment(order, saga.reservationId);
      }

      case 'PAYMENT_COMPLETED':
        return this.checkpoint(order.id, 'COMPLETED', 'CONFIRMED');

      case 'RELEASING_INVENTORY': {
        if (!saga.reservationId) {
          throw new Error('Reservation ID missing');
        }

        return this.compensateInventory(order.id, saga.reservationId);
      }

      case 'RESERVING_INVENTORY':
        this.logger.warn(`Inventory reconciliation required: ${order.id}`);
        return;

      case 'COMPLETED':
      case 'COMPENSATED':
      case 'FAILED':
        return;
    }
  }

  // ==========================================
  // 5. UPDATE SAGA STATE
  // ==========================================

  private async updateSaga(
    orderId: string,
    step: SagaStep,
    data: SagaData = {},
  ) {
    const [saga] = await this.db
      .update(schema.sagaInstances)
      .set({
        ...data,
        step,
        updatedAt: new Date(),
      })
      .where(eq(schema.sagaInstances.orderId, orderId))
      .returning();

    if (!saga) {
      throw new Error('Saga instance not found');
    }

    return saga;
  }

  // ==========================================
  // 6. ATOMIC CHECKPOINT
  // ==========================================

  private async checkpoint(
    orderId: string,
    step: SagaStep,
    orderStatus: OrderStatus,
    data: SagaData = {},
  ) {
    return this.db.transaction(async (tx) => {
      const [saga] = await tx
        .update(schema.sagaInstances)
        .set({
          ...data,
          step,
          updatedAt: new Date(),
        })
        .where(eq(schema.sagaInstances.orderId, orderId))
        .returning();

      if (!saga) {
        throw new Error('Saga instance not found');
      }

      const [order] = await tx
        .update(schema.orders)
        .set({
          status: orderStatus,
          updatedAt: new Date(),
        })
        .where(eq(schema.orders.id, orderId))
        .returning();

      if (!order) {
        throw new Error('Order not found');
      }

      return order;
    });
  }
}

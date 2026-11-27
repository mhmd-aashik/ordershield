import {
 Injectable,
 Inject,
 ConflictException,
 NotFoundException,
 ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.module.js';
import * as schema from '../database/schema.js';
import { ChargePaymentDto } from './dto/charge-payment.dto.js';

@Injectable()
export class PaymentsService {
 constructor(
   @Inject(DATABASE)
   private readonly db: NodePgDatabase<typeof schema>,

   private readonly config: ConfigService,
 ) {}

 async findByOrderId(orderId: string) {
   const [payment] = await this.db
     .select()
     .from(schema.payments)
     .where(eq(schema.payments.orderId, orderId));

   return payment;
 }

 async charge(data: ChargePaymentDto) {
   const existing = await this.findByOrderId(data.orderId);

   if (existing) {
     return this.validateExisting(existing, data.amount);
   }

   const failureMode = this.config.get<string>(
     'PAYMENT_FAILURE_MODE',
     'none',
   );

   if (failureMode === 'unavailable') {
     throw new ServiceUnavailableException(
       'Payment service temporarily unavailable',
     );
   }

   const status =
     failureMode === 'declined'
       ? 'FAILED'
       : 'COMPLETED';

   const [payment] = await this.db
     .insert(schema.payments)
     .values({
       orderId: data.orderId,
       amount: data.amount,
       status,
     })
     .onConflictDoNothing({
       target: schema.payments.orderId,
     })
     .returning();

   if (payment) {
     return payment;
   }

   // Another concurrent request created the payment.
   const duplicate = await this.findByOrderId(data.orderId);

   if (!duplicate) {
     throw new ServiceUnavailableException(
       'Unable to retrieve payment',
     );
   }

   return this.validateExisting(duplicate, data.amount);
 }

 private validateExisting(
   payment: typeof schema.payments.$inferSelect,
   amount: number,
 ) {
   if (payment.amount !== amount) {
     throw new ConflictException(
       'Payment already exists with a different amount',
     );
   }

   return payment;
 }

 async refund(orderId: string) {
   const [payment] = await this.db
     .update(schema.payments)
     .set({
       status: 'REFUNDED',
       updatedAt: new Date(),
     })
     .where(
       and(
         eq(schema.payments.orderId, orderId),
         eq(schema.payments.status, 'COMPLETED'),
       ),
     )
     .returning();

   if (payment) {
     return payment;
   }

   const existing = await this.findByOrderId(orderId);

   if (!existing) {
     throw new NotFoundException('Payment not found');
   }

   if (existing.status === 'REFUNDED') {
     return existing;
   }

   throw new ConflictException(
     'Only completed payments can be refunded',
   );
 }

 async findAll() {
   return this.db.select().from(schema.payments);
 }
}
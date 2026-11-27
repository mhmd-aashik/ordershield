import {
 Injectable,
 Inject,
 ConflictException,
 NotFoundException,
 BadRequestException,
} from '@nestjs/common';

import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, sql } from 'drizzle-orm';

import { DATABASE } from '../database/database.module.js';
import * as schema from '../database/schema.js';

@Injectable()
export class InventoryService {
 constructor(
   @Inject(DATABASE)
   private readonly db: NodePgDatabase<typeof schema>,
 ) {}

 async findAll() {
   return this.db.select().from(schema.inventory);
 }

 async reserve(
   orderId: string,
   productId: string,
   quantity: number,
 ) {
   if (!Number.isInteger(quantity) || quantity <= 0) {
     throw new BadRequestException('Invalid quantity');
   }

   return this.db.transaction(async (tx) => {
     const [product] = await tx
       .update(schema.inventory)
       .set({
         stock: sql`${schema.inventory.stock} - ${quantity}`,
         updatedAt: new Date(),
       })
       .where(
         and(
           eq(schema.inventory.productId, productId),
           gte(schema.inventory.stock, quantity),
         ),
       )
       .returning();

     if (!product) {
       throw new ConflictException('Insufficient stock');
     }

     const [reservation] = await tx
       .insert(schema.reservations)
       .values({
         orderId,
         productId,
         quantity,
         status: 'RESERVED',
       })
       .returning();

     return {
       success: true,
       reservationId: reservation.id,
       remainingStock: product.stock,
     };
   });
 }

 async release(reservationId: string) {
   return this.db.transaction(async (tx) => {
     const [reservation] = await tx
       .update(schema.reservations)
       .set({
         status: 'RELEASED',
       })
       .where(
         and(
           eq(schema.reservations.id, reservationId),
           eq(schema.reservations.status, 'RESERVED'),
         ),
       )
       .returning();

     if (!reservation) {
       const [existing] = await tx
         .select()
         .from(schema.reservations)
         .where(
           eq(schema.reservations.id, reservationId),
         );

       if (!existing) {
         throw new NotFoundException(
           'Reservation not found',
         );
       }

       return {
         success: true,
         message: 'Already released',
       };
     }

     const [product] = await tx
       .update(schema.inventory)
       .set({
         stock: sql`${schema.inventory.stock} + ${reservation.quantity}`,
         updatedAt: new Date(),
       })
       .where(
         eq(
           schema.inventory.productId,
           reservation.productId,
         ),
       )
       .returning();

     return {
       success: true,
       remainingStock: product.stock,
     };
   });
 }
}
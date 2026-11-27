import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
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

  async reserve(orderId: string, productId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Invalid quantity');
    }

    return this.db.transaction(async (tx) => {
      // 1. Attempt to create reservation first
      const [reservation] = await tx
        .insert(schema.reservations)
        .values({
          orderId,
          productId,
          quantity,
          status: 'RESERVED',
        })
        .onConflictDoNothing({
          target: schema.reservations.orderId,
        })
        .returning();

      // 2. Handle duplicate reservation
      if (!reservation) {
        const [existing] = await tx
          .select()
          .from(schema.reservations)
          .where(eq(schema.reservations.orderId, orderId));

        if (!existing) {
          throw new ServiceUnavailableException(
            'Unable to retrieve reservation',
          );
        }

        // Validate original request
        if (
          existing.productId !== productId ||
          existing.quantity !== quantity
        ) {
          throw new ConflictException(
            'Reservation already exists with different payload',
          );
        }

        // Prevent reuse of released reservations
        if (existing.status === 'RELEASED') {
          throw new ConflictException('Reservation has already been released');
        }

        const [product] = await tx
          .select()
          .from(schema.inventory)
          .where(eq(schema.inventory.productId, productId));

        return {
          success: true,
          reservationId: existing.id,
          remainingStock: product.stock,
        };
      }

      // 3. Deduct stock only for a new reservation
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

      // 4. Roll back reservation if stock is insufficient
      if (!product) {
        throw new ConflictException('Insufficient stock');
      }

      // 5. Return successful reservation
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
          .where(eq(schema.reservations.id, reservationId));

        if (!existing) {
          throw new NotFoundException('Reservation not found');
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
        .where(eq(schema.inventory.productId, reservation.productId))
        .returning();

      return {
        success: true,
        remainingStock: product.stock,
      };
    });
  }
}

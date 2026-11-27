import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  BadRequestException,
} from '@nestjs/common';

import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(
    @Body()
    body: {
      productId: string;
      quantity: number;
      amount: number;
    },
    @Headers('idempotency-key')
    idempotencyKey: string,
  ) {
    if (
      typeof idempotencyKey !== 'string' ||
      !idempotencyKey.trim() ||
      idempotencyKey.length > 128
    ) {
      throw new BadRequestException('A valid Idempotency-Key is required');
    }

    return this.ordersService.create({
      ...body,
      idempotencyKey,
    });
  }

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }
}

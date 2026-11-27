import {
  Controller,
  Post,
  Body,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';


@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (
      typeof idempotencyKey !== 'string' ||
      !idempotencyKey.trim() ||
      idempotencyKey.length > 128
    ) {
      throw new BadRequestException('A valid Idempotency-Key is required');
    }

    return this.ordersService.create({
      ...dto,
      idempotencyKey,
    });
  }
}

import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';

import { status } from '@grpc/grpc-js';

import { OrdersService } from './orders.service.js';
import { grpcCall } from '../common/grpc-error.js';

type CreateOrderRequest = {
  productId: string;
  quantity: number;
  amount: number;
  idempotencyKey: string;
};

@Controller()
export class OrdersGrpcController {
  constructor(private readonly ordersService: OrdersService) {}

  @GrpcMethod('OrderService', 'CreateOrder')
  async createOrder(data: CreateOrderRequest) {
    // Validate product ID
    if (
      typeof data.productId !== 'string' ||
      !data.productId.trim() ||
      data.productId.length > 100
    ) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid product ID',
      });
    }

    // Validate quantity
    if (!Number.isInteger(data.quantity) || data.quantity <= 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid quantity',
      });
    }

    // Validate amount
    if (!Number.isInteger(data.amount) || data.amount <= 0) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid amount',
      });
    }

    // Validate idempotency key
    if (
      typeof data.idempotencyKey !== 'string' ||
      !data.idempotencyKey.trim() ||
      data.idempotencyKey.length > 128
    ) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid idempotency key',
      });
    }

    return grpcCall(() => this.ordersService.create(data));
  }
}

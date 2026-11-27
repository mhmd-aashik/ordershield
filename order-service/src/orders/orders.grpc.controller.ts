import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { OrdersService } from './orders.service.js';
import { grpcCall } from '../common/grpc-error.js';

@Controller()
export class OrdersGrpcController {
  constructor(private readonly ordersService: OrdersService) {}

  @GrpcMethod('OrderService', 'CreateOrder')
  createOrder(data: { productId: string; quantity: number; amount: number }) {
    if (
      !data.productId ||
      data.productId.length > 100 ||
      !Number.isInteger(data.quantity) ||
      data.quantity <= 0 ||
      !Number.isInteger(data.amount) ||
      data.amount <= 0
    ) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid order request',
      });
    }

    return grpcCall(() => this.ordersService.create(data));
  }
}

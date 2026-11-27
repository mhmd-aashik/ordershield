import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { isUUID } from 'class-validator';
import { PaymentsService } from './payments.service.js';
import { grpcCall } from '../common/grpc-error.js';

@Controller()
export class PaymentsGrpcController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @GrpcMethod('PaymentService', 'Charge')
  charge(data: { orderId: string; amount: number }) {
    if (
      !isUUID(data.orderId) ||
      !Number.isInteger(data.amount) ||
      data.amount <= 0
    ) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid payment request',
      });
    }

    return grpcCall(() => this.paymentsService.charge(data));
  }

  @GrpcMethod('PaymentService', 'Refund')
  refund(data: { orderId: string }) {
    if (!isUUID(data.orderId)) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid order ID',
      });
    }

    return grpcCall(() => this.paymentsService.refund(data.orderId));
  }
}

import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { isUUID } from 'class-validator';
import { InventoryService } from './inventory.service.js';
import { grpcCall } from '../common/grpc-error.js';

@Controller()
export class InventoryGrpcController {
  constructor(
    private readonly inventoryService: InventoryService,
  ) {}

  @GrpcMethod('InventoryService', 'ReserveStock')
  reserveStock(data: {
    orderId: string;
    productId: string;
    quantity: number;
  }) {
    if (
      !isUUID(data.orderId) ||
      !data.productId ||
      data.productId.length > 100 ||
      !Number.isInteger(data.quantity) ||
      data.quantity <= 0
    ) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid reservation request',
      });
    }

    return grpcCall(() =>
      this.inventoryService.reserve(
        data.orderId,
        data.productId,
        data.quantity,
      ),
    );
  }

  @GrpcMethod('InventoryService', 'ReleaseStock')
  releaseStock(data: { reservationId: string }) {
    if (!isUUID(data.reservationId)) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid reservation ID',
      });
    }

    return grpcCall(() =>
      this.inventoryService.release(data.reservationId),
    );
  }
}
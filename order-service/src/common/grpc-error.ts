import { HttpException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

export async function grpcCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof HttpException) {
      const codes: Record<number, number> = {
        400: status.INVALID_ARGUMENT,
        404: status.NOT_FOUND,
        409: status.FAILED_PRECONDITION,
        503: status.UNAVAILABLE,
      };

      throw new RpcException({
        code: codes[error.getStatus()] ?? status.INTERNAL,
        message: error.message,
      });
    }

    throw new RpcException({
      code: status.INTERNAL,
      message: 'Internal service error',
    });
  }
}

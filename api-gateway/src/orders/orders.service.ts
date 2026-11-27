import {
  Injectable,
  Inject,
  OnModuleInit,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { firstValueFrom, Observable } from 'rxjs';
import { CreateOrderDto } from './dto/create-order.dto.js';

interface OrderGrpcService {
  createOrder(data: CreateOrderDto): Observable<{
    id: string;
    productId: string;
    quantity: number;
    amount: number;
    status: string;
  }>;
}

@Injectable()
export class OrdersService implements OnModuleInit {
  private orderService: OrderGrpcService;

  constructor(
    @Inject('ORDER_SERVICE')
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.orderService =
      this.client.getService<OrderGrpcService>('OrderService');
  }

  async create(data: CreateOrderDto) {
    try {
      return await firstValueFrom(this.orderService.createOrder(data));
    } catch (error) {
      const err = error as {
        code?: number;
        details?: string;
      };

      const codes: Record<number, number> = {
        [status.INVALID_ARGUMENT]: 400,
        [status.NOT_FOUND]: 404,
        [status.FAILED_PRECONDITION]: 409,
        [status.UNAVAILABLE]: 503,
        [status.DEADLINE_EXCEEDED]: 504,
      };

      throw new HttpException(
        err.details || 'Order service error',
        codes[err.code ?? -1] ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

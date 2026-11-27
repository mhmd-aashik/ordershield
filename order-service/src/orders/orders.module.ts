import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { DatabaseModule } from '../database/database.module.js';
import { OrdersGrpcController } from './orders.grpc.controller.js';

@Module({
  imports: [DatabaseModule],
  providers: [OrdersService],
  controllers: [OrdersController, OrdersGrpcController],
})
export class OrdersModule {}

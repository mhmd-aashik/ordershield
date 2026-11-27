import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { ServiceClientsModule } from '../clients/clients.module.js';

import { OrdersController } from './orders.controller.js';
import { OrdersGrpcController } from './orders.grpc.controller.js';
import { OrdersService } from './orders.service.js';
import { OrderSagaService } from './saga/order-saga.service.js';

@Module({
  imports: [DatabaseModule, ServiceClientsModule],
  controllers: [OrdersController, OrdersGrpcController],
  providers: [OrdersService, OrderSagaService],
})
export class OrdersModule {}

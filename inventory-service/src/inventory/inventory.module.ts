import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { InventoryController } from './inventory.controller.js';
import { DatabaseModule } from '../database/database.module.js';
import { InventoryGrpcController } from './inventory.grpc.controller.js';

@Module({
  imports: [DatabaseModule],
  providers: [InventoryService],
  controllers: [InventoryController, InventoryGrpcController],
})
export class InventoryModule {}

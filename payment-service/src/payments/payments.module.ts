import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { DatabaseModule } from '../database/database.module.js';
import { PaymentsGrpcController } from './payments.grpc.controller.js';

@Module({
  imports: [DatabaseModule],
  providers: [PaymentsService],
  controllers: [PaymentsController, PaymentsGrpcController],
})
export class PaymentsModule {}

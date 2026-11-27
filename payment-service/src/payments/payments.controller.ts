import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';

import { PaymentsService } from './payments.service.js';
import { ChargePaymentDto } from './dto/charge-payment.dto.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('charge')
  charge(@Body() body: ChargePaymentDto) {
    return this.paymentsService.charge(body);
  }

  @Post('refund/:orderId')
  refund(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.paymentsService.refund(orderId);
  }

  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }
}

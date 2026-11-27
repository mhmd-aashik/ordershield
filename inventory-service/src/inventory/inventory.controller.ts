import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';

import { InventoryService } from './inventory.service.js';
import { ReserveStockDto } from './dto/reserve-stock.dto.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll() {
    return this.inventoryService.findAll();
  }

  @Post('reserve')
  reserve(@Body() body: ReserveStockDto) {
    return this.inventoryService.reserve(
      body.orderId,
      body.productId,
      body.quantity,
    );
  }

  @Post('release/:reservationId')
  release(
    @Param('reservationId', ParseUUIDPipe)
    reservationId: string,
  ) {
    return this.inventoryService.release(reservationId);
  }
}

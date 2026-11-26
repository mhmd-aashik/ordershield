import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return {
      service: 'api-gateway',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

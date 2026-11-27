import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { resolve } from 'node:path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'order',
      protoPath: resolve(process.cwd(), '../proto/order.proto'),
      url: `0.0.0.0:${config.get('GRPC_PORT', 50051)}`,
    },
  });

  await app.startAllMicroservices();

  await app.listen(config.get<number>('PORT', 3001));
}
await bootstrap();

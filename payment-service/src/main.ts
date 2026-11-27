import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { resolve } from 'node:path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'payment',
      protoPath: resolve(process.cwd(), '../proto/payment.proto'),
      url: `0.0.0.0:${config.get('GRPC_PORT', 50053)}`,
    },
  });

  await app.startAllMicroservices();

  await app.listen(config.get<number>('PORT', 3003));
}
await bootstrap();

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { resolve } from 'path';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'INVENTORY_SERVICE',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'inventory',
            protoPath: resolve(process.cwd(), '../proto/inventory.proto'),
            url: config.getOrThrow<string>('INVENTORY_SERVICE_URL'),
          },
        }),
      },
      {
        name: 'PAYMENT_SERVICE',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'payment',
            protoPath: resolve(process.cwd(), '../proto/payment.proto'),
            url: config.getOrThrow<string>('PAYMENT_SERVICE_URL'),
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class ServiceClientsModule {}

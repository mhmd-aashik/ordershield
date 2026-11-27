import { IsUUID, IsInt, Min, Max } from 'class-validator';

export class ChargePaymentDto {
  @IsUUID()
  orderId: string;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  amount: number;
}

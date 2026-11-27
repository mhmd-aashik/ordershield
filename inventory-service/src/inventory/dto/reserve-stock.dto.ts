import {
  IsUUID,
  IsString,
  IsInt,
  Min,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class ReserveStockDto {
  @IsUUID()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

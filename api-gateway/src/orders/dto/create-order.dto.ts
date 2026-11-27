import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: 'P100' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  productId: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity: number;

  @ApiProperty({ example: 15000 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  amount: number;
}

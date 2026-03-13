import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class SubmitPaymentDto {
  @IsString()
  @IsNotEmpty()
  packageId: string;

  @IsString()
  @IsNotEmpty()
  packageName: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  trxId: string;

  @IsString()
  @IsNotEmpty()
  senderNumber: string;
}

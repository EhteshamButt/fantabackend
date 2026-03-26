import { IsEnum, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { WithdrawalMethod } from '../withdrawal.entity';

export class CreateWithdrawalDto {
  @IsEnum(WithdrawalMethod)
  @IsNotEmpty()
  method: WithdrawalMethod;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  amount: number;
}

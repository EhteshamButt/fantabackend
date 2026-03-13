import { IsEnum, IsNotEmpty } from 'class-validator';
import { WithdrawalStatus } from '../withdrawal.schema';

export class UpdateWithdrawalStatusDto {
  @IsEnum(WithdrawalStatus)
  @IsNotEmpty()
  status: WithdrawalStatus;
}

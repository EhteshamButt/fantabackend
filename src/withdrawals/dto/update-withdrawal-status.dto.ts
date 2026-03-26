import { IsEnum, IsNotEmpty } from 'class-validator';
import { WithdrawalStatus } from '../withdrawal.entity';

export class UpdateWithdrawalStatusDto {
  @IsEnum(WithdrawalStatus)
  @IsNotEmpty()
  status: WithdrawalStatus;
}

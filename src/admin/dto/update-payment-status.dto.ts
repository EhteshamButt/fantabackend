import { IsEnum, IsNotEmpty } from 'class-validator';
import { PaymentStatus } from '../../payments/payment.entity';

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  status: PaymentStatus;
}

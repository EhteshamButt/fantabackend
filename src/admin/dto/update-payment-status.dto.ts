import { IsEnum, IsNotEmpty } from 'class-validator';
import { PaymentStatus } from '../../payments/payment.schema';

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  status: PaymentStatus;
}

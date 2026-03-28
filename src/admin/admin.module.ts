import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/user.entity';
import { Payment } from '../payments/payment.entity';
import { Withdrawal } from '../withdrawals/withdrawal.entity';
import { ReferralSettingsModule } from '../referral-settings/referral-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Payment, Withdrawal]),
    ReferralSettingsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

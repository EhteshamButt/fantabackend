import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/user.entity';
import { Payment } from '../payments/payment.entity';
import { Withdrawal } from '../withdrawals/withdrawal.entity';
import { LoginHistory } from './login-history.entity';
import { Notification } from './notification.entity';
import { ReferralSettingsModule } from '../referral-settings/referral-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Payment, Withdrawal, LoginHistory, Notification]),
    ReferralSettingsModule,
    ConfigModule,
    JwtModule.register({}),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

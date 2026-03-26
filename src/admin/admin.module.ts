import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/user.entity';
import { Payment } from '../payments/payment.entity';
import { Withdrawal } from '../withdrawals/withdrawal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Payment, Withdrawal])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

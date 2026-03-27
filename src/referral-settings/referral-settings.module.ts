import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralSetting } from './referral-setting.entity';
import { ReferralSettingsService } from './referral-settings.service';
import { ReferralSettingsController } from './referral-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReferralSetting])],
  controllers: [ReferralSettingsController],
  providers: [ReferralSettingsService],
  exports: [ReferralSettingsService],
})
export class ReferralSettingsModule {}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferralSetting, CommissionType } from './referral-setting.entity';

@Injectable()
export class ReferralSettingsService {
  constructor(
    @InjectRepository(ReferralSetting)
    private settingRepo: Repository<ReferralSetting>,
  ) {}

  async getAllSettings(): Promise<ReferralSetting[]> {
    let settings = await this.settingRepo.find();

    // Seed defaults if empty
    if (settings.length === 0) {
      const defaults = Object.values(CommissionType).map((type) =>
        this.settingRepo.create({ type, enabled: true, levels: [] }),
      );
      settings = await this.settingRepo.save(defaults);
    }

    return settings;
  }

  async getByType(type: CommissionType): Promise<ReferralSetting> {
    let setting = await this.settingRepo.findOne({ where: { type } });
    if (!setting) {
      setting = this.settingRepo.create({ type, enabled: true, levels: [] });
      setting = await this.settingRepo.save(setting);
    }
    return setting;
  }

  async updateLevels(
    type: CommissionType,
    levels: { level: number; percentage: number }[],
  ): Promise<ReferralSetting> {
    const setting = await this.getByType(type);
    setting.levels = levels;
    return this.settingRepo.save(setting);
  }

  async toggleEnabled(
    type: CommissionType,
    enabled: boolean,
  ): Promise<ReferralSetting> {
    const setting = await this.getByType(type);
    setting.enabled = enabled;
    return this.settingRepo.save(setting);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeneralSetting } from './general-setting.entity';
import { UpdateGeneralSettingDto } from './dto/update-general-setting.dto';

@Injectable()
export class GeneralSettingsService {
  constructor(
    @InjectRepository(GeneralSetting)
    private readonly generalSettingRepo: Repository<GeneralSetting>,
  ) {}

  async getSettings(): Promise<GeneralSetting> {
    const rows = await this.generalSettingRepo.find({
      order: { createdAt: 'ASC' },
      take: 1,
    });
    let settings = rows[0];

    if (!settings) {
      settings = this.generalSettingRepo.create();
      settings = await this.generalSettingRepo.save(settings);
    }

    return settings;
  }

  async updateSettings(dto: UpdateGeneralSettingDto): Promise<GeneralSetting> {
    const settings = await this.getSettings();
    const merged = this.generalSettingRepo.merge(settings, dto);
    return this.generalSettingRepo.save(merged);
  }
}


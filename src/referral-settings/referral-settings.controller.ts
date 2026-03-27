import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ReferralSettingsService } from './referral-settings.service';
import { CommissionType } from './referral-setting.entity';
import {
  UpdateReferralSettingDto,
  ToggleReferralSettingDto,
} from './dto/update-referral-setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/user.entity';

@Controller('referral-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ReferralSettingsController {
  constructor(private readonly service: ReferralSettingsService) {}

  @Get()
  getAll() {
    return this.service.getAllSettings();
  }

  @Get(':type')
  getByType(@Param('type') type: CommissionType) {
    return this.service.getByType(type);
  }

  @Patch(':type/levels')
  updateLevels(
    @Param('type') type: CommissionType,
    @Body() dto: UpdateReferralSettingDto,
  ) {
    return this.service.updateLevels(type, dto.levels);
  }

  @Patch(':type/toggle')
  toggle(
    @Param('type') type: CommissionType,
    @Body() dto: ToggleReferralSettingDto,
  ) {
    return this.service.toggleEnabled(type, dto.enabled);
  }
}

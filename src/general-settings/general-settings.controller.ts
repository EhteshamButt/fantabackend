import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { GeneralSettingsService } from './general-settings.service';
import { UpdateGeneralSettingDto } from './dto/update-general-setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/user.entity';

@Controller('general-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class GeneralSettingsController {
  constructor(private readonly generalSettingsService: GeneralSettingsService) {}

  @Get()
  getSettings() {
    return this.generalSettingsService.getSettings();
  }

  @Patch()
  updateSettings(@Body() dto: UpdateGeneralSettingDto) {
    return this.generalSettingsService.updateSettings(dto);
  }
}


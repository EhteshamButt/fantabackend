import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalStatusDto } from './dto/update-withdrawal-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/user.schema';

@Controller('withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  // ─── Client endpoints ───

  @Post('submit')
  @Roles(Role.CLIENT)
  @HttpCode(HttpStatus.CREATED)
  createWithdrawal(@Req() req: any, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawalsService.createWithdrawal(req.user.id, dto);
  }

  @Get('my')
  @Roles(Role.CLIENT)
  getUserWithdrawals(@Req() req: any) {
    return this.withdrawalsService.getUserWithdrawals(req.user.id);
  }

  // ─── Admin endpoints ───

  @Get('all')
  @Roles(Role.ADMIN)
  getAllWithdrawals() {
    return this.withdrawalsService.getAllWithdrawals();
  }

  @Get('pending')
  @Roles(Role.ADMIN)
  getPendingWithdrawals() {
    return this.withdrawalsService.getPendingWithdrawals();
  }

  @Get('pending/count')
  @Roles(Role.ADMIN)
  async getPendingCount() {
    const count = await this.withdrawalsService.getPendingCount();
    return { count };
  }

  @Get('today-approved')
  @Roles(Role.ADMIN)
  getTodayApproved() {
    return this.withdrawalsService.getTodayApproved();
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  updateWithdrawalStatus(
    @Param('id') id: string,
    @Body() dto: UpdateWithdrawalStatusDto,
  ) {
    return this.withdrawalsService.updateWithdrawalStatus(id, dto.status);
  }
}

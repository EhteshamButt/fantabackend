import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/user.schema';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('payments')
  getAllPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllPayments(
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Get('payments/pending')
  getPendingPayments() {
    return this.adminService.getPendingPayments();
  }

  @Patch('payments/:id/status')
  updatePaymentStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.adminService.updatePaymentStatus(id, dto.status);
  }

  @Get('users/approved')
  getApprovedUsers() {
    return this.adminService.getApprovedUsers();
  }

  @Get('users/today-approved')
  getTodayApprovedUsers() {
    return this.adminService.getTodayApprovedUsers();
  }

  @Get('users/rejected')
  getRejectedUsers() {
    return this.adminService.getRejectedUsers();
  }
}

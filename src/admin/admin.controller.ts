import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Put,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/user.entity';

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

  @Get('users/:id')
  getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Put('users/:id')
  updateUserDetail(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.adminService.updateUserDetail(id, body as Parameters<typeof this.adminService.updateUserDetail>[1]);
  }

  @Patch('users/:id/balance')
  adjustBalance(
    @Param('id') id: string,
    @Body() body: { amount: number; type: 'add' | 'subtract' },
  ) {
    return this.adminService.adjustBalance(id, body.amount, body.type);
  }

  @Patch('users/:id/ban')
  banUser(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.adminService.banUser(id, body.reason);
  }

  @Patch('users/:id/unban')
  unbanUser(@Param('id') id: string) {
    return this.adminService.unbanUser(id);
  }

  @Get('users/:id/logins')
  getLoginHistory(@Param('id') id: string) {
    return this.adminService.getLoginHistory(id);
  }

  @Get('users/:id/notifications')
  getNotifications(@Param('id') id: string) {
    return this.adminService.getNotifications(id);
  }

  @Post('users/:id/notifications')
  sendNotification(
    @Param('id') id: string,
    @Body() body: { subject: string; message: string; sentVia?: string },
  ) {
    return this.adminService.sendNotification(id, body.subject, body.message, body.sentVia || 'system');
  }

  @Post('users/:id/impersonate')
  impersonateUser(@Param('id') id: string) {
    return this.adminService.impersonateUser(id);
  }
}

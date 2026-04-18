import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { Role, User } from '../users/user.entity';
import { Payment, PaymentStatus } from '../payments/payment.entity';
import { Withdrawal, WithdrawalStatus } from '../withdrawals/withdrawal.entity';
import { LoginHistory } from './login-history.entity';
import { Notification } from './notification.entity';
import { ReferralSettingsService } from '../referral-settings/referral-settings.service';
import { CommissionType } from '../referral-settings/referral-setting.entity';
import { randomBytes } from 'crypto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Withdrawal) private withdrawalRepo: Repository<Withdrawal>,
    @InjectRepository(LoginHistory) private loginHistoryRepo: Repository<LoginHistory>,
    @InjectRepository(Notification) private notificationRepo: Repository<Notification>,
    private referralSettingsService: ReferralSettingsService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async getDashboardStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalDepositedResult,
      todayApprovedUsers,
      pendingRequests,
      rejectedUsers,
      totalWithdrawnResult,
      todayWithdrawals,
      pendingWithdrawals,
    ] = await Promise.all([
      this.userRepo.count(),
      this.paymentRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount), 0)', 'total')
        .where('p.status = :status', { status: PaymentStatus.APPROVED })
        .getRawOne(),
      this.paymentRepo.count({
        where: {
          status: PaymentStatus.APPROVED,
          updatedAt: MoreThanOrEqual(todayStart),
        },
      }),
      this.paymentRepo.count({ where: { status: PaymentStatus.PENDING } }),
      this.paymentRepo.count({ where: { status: PaymentStatus.REJECTED } }),
      this.withdrawalRepo
        .createQueryBuilder('w')
        .select('COALESCE(SUM(w.amount), 0)', 'total')
        .where('w.status = :status', { status: WithdrawalStatus.APPROVED })
        .getRawOne(),
      this.withdrawalRepo.count({
        where: {
          status: WithdrawalStatus.APPROVED,
          updatedAt: MoreThanOrEqual(todayStart),
        },
      }),
      this.withdrawalRepo.count({ where: { status: WithdrawalStatus.PENDING } }),
    ]);

    return {
      totalUsers,
      totalDeposited: parseFloat(totalDepositedResult?.total || '0'),
      todayApprovedUsers,
      pendingRequests,
      rejectedUsers,
      referralCommissions: 0,
      todayWithdrawals,
      totalWithdrawn: parseFloat(totalWithdrawnResult?.total || '0'),
      pendingWithdrawals,
      totalTaskEarnings: 0,
      manualAdditions: 0,
      manualSubtractions: 0,
      netManualBalance: 0,
    };
  }

  async getAllPayments(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [payments, total] = await this.paymentRepo.findAndCount({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPendingPayments() {
    return this.paymentRepo.find({
      where: { status: PaymentStatus.PENDING },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async updatePaymentStatus(paymentId: string, status: PaymentStatus) {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['user'],
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const wasPending = payment.status === PaymentStatus.PENDING;
    payment.status = status;
    await this.paymentRepo.save(payment);

    // On first-time approval from pending, set user role to client and credit referral commission
    if (wasPending && status === PaymentStatus.APPROVED) {
      await Promise.all([
        this.userRepo.update(payment.userId, { role: Role.CLIENT }),
        this.creditReferralCommission(payment.userId, payment.amount),
      ]);
    }

    return payment;
  }

  private async creditReferralCommission(
    userId: string,
    depositAmount: number | string,
  ) {
    const depositSetting = await this.referralSettingsService.getByType(
      CommissionType.DEPOSIT,
    );
    if (!depositSetting.enabled || depositSetting.levels.length === 0) return;

    const amount = parseFloat(depositAmount.toString());
    if (isNaN(amount) || amount <= 0) return;

    // Sort levels by level number to ensure correct order
    const sortedLevels = [...depositSetting.levels].sort(
      (a, b) => a.level - b.level,
    );

    // Walk up the referral chain
    let currentUserId = userId;
    for (const levelConfig of sortedLevels) {
      const currentUser = await this.userRepo.findOne({
        where: { id: currentUserId },
      });
      if (!currentUser?.referredBy) break;

      const referrer = await this.userRepo.findOne({
        where: { id: currentUser.referredBy },
      });
      if (!referrer) break;

      const commission = (amount * levelConfig.percentage) / 100;
      const currentBalance = parseFloat(referrer.walletBalance.toString());
      referrer.walletBalance = parseFloat(
        (currentBalance + commission).toFixed(2),
      );
      await this.userRepo.save(referrer);

      console.log(
        `Referral commission: Level ${levelConfig.level} - ${levelConfig.percentage}% of ${amount} = ${commission} credited to ${referrer.email} (balance: ${referrer.walletBalance})`,
      );

      // Move up to next level
      currentUserId = referrer.id;
    }
  }

  async getApprovedUsers() {
    const approvedPayments = await this.paymentRepo.find({
      where: { status: PaymentStatus.APPROVED },
      select: ['userId'],
    });
    const userIds = [...new Set(approvedPayments.map((p) => p.userId))];
    if (userIds.length === 0) return [];
    return this.userRepo.find({
      where: { id: In(userIds) },
      select: ['id', 'name', 'email', 'phone', 'role', 'walletBalance', 'level', 'dailyLimit', 'referralCode', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async getTodayApprovedUsers() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.paymentRepo.find({
      where: {
        status: PaymentStatus.APPROVED,
        updatedAt: MoreThanOrEqual(todayStart),
      },
      relations: ['user'],
      order: { updatedAt: 'DESC' },
    });
  }

  async getRejectedUsers() {
    return this.paymentRepo.find({
      where: { status: PaymentStatus.REJECTED },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [deposits, withdrawals, teamCount] = await Promise.all([
      this.paymentRepo.find({ where: { userId, status: PaymentStatus.APPROVED }, order: { createdAt: 'DESC' } }),
      this.withdrawalRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      this.userRepo.count({ where: { referredBy: userId } }),
    ]);

    const totalDeposited = deposits.reduce((s, p) => s + parseFloat(p.amount.toString()), 0);
    const totalWithdrawn = withdrawals
      .filter((w) => w.status === WithdrawalStatus.APPROVED)
      .reduce((s, w) => s + parseFloat(w.amount.toString()), 0);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, refresh_token: _rt, ...safeUser } = user as unknown as Record<string, unknown> & { password: string; refresh_token: string };

    return {
      user: safeUser,
      stats: {
        balance: parseFloat(user.walletBalance.toString()),
        totalDeposited,
        totalWithdrawn,
        totalTransactions: deposits.length + withdrawals.length,
        teamCount,
      },
    };
  }

  async updateUserDetail(
    userId: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      level?: number;
      dailyLimit?: number;
      referralCode?: string;
      walletBalance?: number;
    },
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    Object.assign(user, data);
    return this.userRepo.save(user);
  }

  async adjustBalance(userId: string, amount: number, type: 'add' | 'subtract') {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const current = parseFloat(user.walletBalance.toString());
    user.walletBalance = parseFloat(
      (type === 'add' ? current + amount : Math.max(0, current - amount)).toFixed(2),
    );
    await this.userRepo.save(user);
    return { balance: user.walletBalance };
  }

  async banUser(userId: string, reason: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isBanned = true;
    user.banReason = reason;
    return this.userRepo.save(user);
  }

  async unbanUser(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.isBanned = false;
    user.banReason = null;
    return this.userRepo.save(user);
  }

  async getLoginHistory(userId: string) {
    return this.loginHistoryRepo.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async getNotifications(userId: string) {
    return this.notificationRepo.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async sendNotification(userId: string, subject: string, message: string, sentVia: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const notif = this.notificationRepo.create({ userId, subject, message, sentVia });
    return this.notificationRepo.save(notif);
  }

  async impersonateUser(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const jti = randomBytes(16).toString('hex');
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role, jti },
      {
        secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
        expiresIn: '2h',
      },
    );
    return { accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { User } from '../users/user.entity';
import { Payment, PaymentStatus } from '../payments/payment.entity';
import { Withdrawal, WithdrawalStatus } from '../withdrawals/withdrawal.entity';
import { ReferralSettingsService } from '../referral-settings/referral-settings.service';
import { CommissionType } from '../referral-settings/referral-setting.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Withdrawal) private withdrawalRepo: Repository<Withdrawal>,
    private referralSettingsService: ReferralSettingsService,
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

    // Credit referral commission when a payment is approved
    if (wasPending && status === PaymentStatus.APPROVED) {
      await this.creditReferralCommission(payment.userId, payment.amount);
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
      select: ['id', 'name', 'email', 'role', 'createdAt'],
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
}

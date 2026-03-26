import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { User } from '../users/user.entity';
import { Payment, PaymentStatus } from '../payments/payment.entity';
import { Withdrawal, WithdrawalStatus } from '../withdrawals/withdrawal.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Withdrawal) private withdrawalRepo: Repository<Withdrawal>,
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
    const result = await this.paymentRepo.update(paymentId, { status });
    if (result.affected === 0) {
      throw new NotFoundException('Payment not found');
    }
    return this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['user'],
    });
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

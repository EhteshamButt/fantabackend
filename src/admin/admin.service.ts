import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';
import { Payment, PaymentStatus } from '../payments/payment.schema';
import { Withdrawal, WithdrawalStatus } from '../withdrawals/withdrawal.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    @InjectModel(Withdrawal.name) private withdrawalModel: Model<Withdrawal>,
  ) {}

  async getDashboardStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalDepositedAgg,
      todayApprovedUsers,
      pendingRequests,
      rejectedUsers,
      totalWithdrawnAgg,
      todayWithdrawals,
      pendingWithdrawals,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.paymentModel.aggregate([
        { $match: { status: PaymentStatus.APPROVED } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.paymentModel.countDocuments({
        status: PaymentStatus.APPROVED,
        updatedAt: { $gte: todayStart },
      }),
      this.paymentModel.countDocuments({ status: PaymentStatus.PENDING }),
      this.paymentModel.countDocuments({ status: PaymentStatus.REJECTED }),
      this.withdrawalModel.aggregate([
        { $match: { status: WithdrawalStatus.APPROVED } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      this.withdrawalModel.countDocuments({
        status: WithdrawalStatus.APPROVED,
        updatedAt: { $gte: todayStart },
      }),
      this.withdrawalModel.countDocuments({ status: WithdrawalStatus.PENDING }),
    ]);

    return {
      totalUsers,
      totalDeposited: totalDepositedAgg[0]?.total || 0,
      todayApprovedUsers,
      pendingRequests,
      rejectedUsers,
      referralCommissions: 0,
      todayWithdrawals,
      totalWithdrawn: totalWithdrawnAgg[0]?.total || 0,
      pendingWithdrawals,
      totalTaskEarnings: 0,
      manualAdditions: 0,
      manualSubtractions: 0,
      netManualBalance: 0,
    };
  }

  async getAllPayments(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      this.paymentModel
        .find()
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.paymentModel.countDocuments(),
    ]);
    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPendingPayments() {
    return this.paymentModel
      .find({ status: PaymentStatus.PENDING })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async updatePaymentStatus(paymentId: string, status: PaymentStatus) {
    const payment = await this.paymentModel
      .findByIdAndUpdate(paymentId, { status }, { new: true })
      .populate('userId', 'name email')
      .lean();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async getApprovedUsers() {
    const approvedUserIds = await this.paymentModel
      .find({ status: PaymentStatus.APPROVED })
      .distinct('userId');
    return this.userModel
      .find({ _id: { $in: approvedUserIds } })
      .select('name email role createdAt')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getTodayApprovedUsers() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.paymentModel
      .find({
        status: PaymentStatus.APPROVED,
        updatedAt: { $gte: todayStart },
      })
      .populate('userId', 'name email role createdAt')
      .sort({ updatedAt: -1 })
      .lean();
  }

  async getRejectedUsers() {
    return this.paymentModel
      .find({ status: PaymentStatus.REJECTED })
      .populate('userId', 'name email role createdAt')
      .sort({ createdAt: -1 })
      .lean();
  }
}

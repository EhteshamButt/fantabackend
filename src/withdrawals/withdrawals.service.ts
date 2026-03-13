import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { Withdrawal, WithdrawalStatus } from './withdrawal.schema';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Injectable()
export class WithdrawalsService {
  constructor(
    @InjectModel(Withdrawal.name) private withdrawalModel: Model<Withdrawal>,
  ) {}

  async createWithdrawal(userId: string, dto: CreateWithdrawalDto) {
    const trxId = randomBytes(8).toString('hex').toUpperCase();
    const withdrawal = await this.withdrawalModel.create({
      userId,
      method: dto.method,
      amount: dto.amount,
      trxId,
      status: WithdrawalStatus.PENDING,
    });
    return {
      id: withdrawal._id,
      method: withdrawal.method,
      amount: withdrawal.amount,
      trxId: withdrawal.trxId,
      status: withdrawal.status,
      createdAt: (withdrawal as any).createdAt,
    };
  }

  async getUserWithdrawals(userId: string) {
    return this.withdrawalModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .select('method amount trxId status createdAt updatedAt')
      .lean();
  }

  async getAllWithdrawals() {
    return this.withdrawalModel
      .find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getPendingWithdrawals() {
    return this.withdrawalModel
      .find({ status: WithdrawalStatus.PENDING })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async updateWithdrawalStatus(id: string, status: WithdrawalStatus) {
    const withdrawal = await this.withdrawalModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .populate('userId', 'name email')
      .lean();
    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }
    return withdrawal;
  }

  async getPendingCount(): Promise<number> {
    return this.withdrawalModel.countDocuments({ status: WithdrawalStatus.PENDING });
  }

  async getTodayApproved() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.withdrawalModel
      .find({
        status: WithdrawalStatus.APPROVED,
        updatedAt: { $gte: todayStart },
      })
      .populate('userId', 'name email')
      .sort({ updatedAt: -1 })
      .lean();
  }

  async getTotalWithdrawn(): Promise<number> {
    const result = await this.withdrawalModel.aggregate([
      { $match: { status: WithdrawalStatus.APPROVED } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total || 0;
  }

  async getTodayWithdrawalsCount(): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.withdrawalModel.countDocuments({
      status: WithdrawalStatus.APPROVED,
      updatedAt: { $gte: todayStart },
    });
  }
}

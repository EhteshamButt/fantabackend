import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { randomBytes } from 'crypto';
import { Withdrawal, WithdrawalStatus } from './withdrawal.entity';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Injectable()
export class WithdrawalsService {
  constructor(
    @InjectRepository(Withdrawal) private withdrawalRepo: Repository<Withdrawal>,
  ) {}

  async createWithdrawal(userId: string, dto: CreateWithdrawalDto) {
    const trxId = randomBytes(8).toString('hex').toUpperCase();
    const withdrawal = this.withdrawalRepo.create({
      userId,
      method: dto.method,
      amount: dto.amount,
      trxId,
      status: WithdrawalStatus.PENDING,
    });
    await this.withdrawalRepo.save(withdrawal);
    return {
      id: withdrawal.id,
      method: withdrawal.method,
      amount: withdrawal.amount,
      trxId: withdrawal.trxId,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
    };
  }

  async getUserWithdrawals(userId: string) {
    return this.withdrawalRepo.find({
      where: { userId },
      select: ['id', 'method', 'amount', 'trxId', 'status', 'createdAt', 'updatedAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async getAllWithdrawals() {
    return this.withdrawalRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async getPendingWithdrawals() {
    return this.withdrawalRepo.find({
      where: { status: WithdrawalStatus.PENDING },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateWithdrawalStatus(id: string, status: WithdrawalStatus) {
    const result = await this.withdrawalRepo.update(id, { status });
    if (result.affected === 0) {
      throw new NotFoundException('Withdrawal not found');
    }
    return this.withdrawalRepo.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  async getPendingCount(): Promise<number> {
    return this.withdrawalRepo.count({ where: { status: WithdrawalStatus.PENDING } });
  }

  async getTodayApproved() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.withdrawalRepo.find({
      where: {
        status: WithdrawalStatus.APPROVED,
        updatedAt: MoreThanOrEqual(todayStart),
      },
      relations: ['user'],
      order: { updatedAt: 'DESC' },
    });
  }

  async getTotalWithdrawn(): Promise<number> {
    const result = await this.withdrawalRepo
      .createQueryBuilder('w')
      .select('COALESCE(SUM(w.amount), 0)', 'total')
      .where('w.status = :status', { status: WithdrawalStatus.APPROVED })
      .getRawOne();
    return parseFloat(result?.total || '0');
  }

  async getTodayWithdrawalsCount(): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return this.withdrawalRepo.count({
      where: {
        status: WithdrawalStatus.APPROVED,
        updatedAt: MoreThanOrEqual(todayStart),
      },
    });
  }
}

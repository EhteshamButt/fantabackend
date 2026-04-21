import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { randomBytes } from 'crypto';
import { Withdrawal, WithdrawalStatus } from './withdrawal.entity';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { Role, User } from '../users/user.entity';

@Injectable()
export class WithdrawalsService {
  constructor(
    @InjectRepository(Withdrawal) private withdrawalRepo: Repository<Withdrawal>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async createWithdrawal(userId: string, dto: CreateWithdrawalDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const currentBalance = parseFloat(user?.walletBalance?.toString() || '0');
    if (dto.amount > currentBalance) {
      throw new BadRequestException('You do not have sufficient balance for withdraw.');
    }

    const previousCount = await this.withdrawalRepo.count({ where: { userId } });
    if (previousCount === 0 && dto.amount !== 50) {
      throw new BadRequestException('First withdrawal must be exactly 50 Rs');
    }
    if (previousCount > 0 && dto.amount < 500) {
      throw new BadRequestException('Minimum withdrawal is 500 Rs');
    }

    const trxId = randomBytes(8).toString('hex').toUpperCase();
    const withdrawal = this.withdrawalRepo.create({
      userId,
      method: dto.method,
      amount: dto.amount,
      trxId,
      accountName: dto.accountName ?? null,
      accountNumber: dto.accountNumber ?? null,
      status: WithdrawalStatus.PENDING,
    });
    await this.withdrawalRepo.save(withdrawal);
    return {
      id: withdrawal.id,
      method: withdrawal.method,
      amount: withdrawal.amount,
      trxId: withdrawal.trxId,
      accountName: withdrawal.accountName,
      accountNumber: withdrawal.accountNumber,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
    };
  }

  async getUserWithdrawals(userId: string) {
    return this.withdrawalRepo.find({
      where: { userId },
      select: ['id', 'method', 'amount', 'trxId', 'accountName', 'accountNumber', 'status', 'createdAt', 'updatedAt'],
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
    const withdrawal = await this.withdrawalRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    const wasPending = withdrawal.status === WithdrawalStatus.PENDING;
    withdrawal.status = status;
    await this.withdrawalRepo.save(withdrawal);

    // When a withdrawal is approved from pending, set the user's role to client
    if (wasPending && status === WithdrawalStatus.APPROVED) {
      await this.userRepo.update(withdrawal.userId, { role: Role.CLIENT });
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

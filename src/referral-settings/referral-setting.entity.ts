import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CommissionType {
  DEPOSIT = 'deposit_commission',
  PLAN_SUBSCRIPTION = 'plan_subscription',
  PTC_VIEW = 'ptc_view',
}

@Entity('referral_settings')
export class ReferralSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: CommissionType, unique: true })
  type: CommissionType;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', default: [] })
  levels: { level: number; percentage: number }[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

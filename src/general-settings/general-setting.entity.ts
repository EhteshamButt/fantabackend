import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('general_settings')
export class GeneralSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'Fanta Earn' })
  siteTitle: string;

  @Column({ default: 'Rs' })
  currency: string;

  @Column({ default: 'Rs' })
  currencySymbol: string;

  @Column({ default: 'Asia/Karachi' })
  timezone: string;

  @Column({ default: 'e65353' })
  siteBaseColor: string;

  @Column({ default: '000000' })
  siteSecondaryColor: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 50 })
  registrationBonus: number;

  @Column({ default: 'None' })
  defaultPlan: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 2 })
  balanceTransferFixedCharge: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 2 })
  balanceTransferPercentCharge: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


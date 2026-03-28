import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

export enum Role {
  ADMIN = 'admin',
  USER = 'user',
  CLIENT = 'client',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role;

  @Column({ type: 'text', nullable: true, default: null })
  refresh_token: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  referralCode: string | null;

  @Column({ type: 'uuid', nullable: true })
  referredBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'referredBy' })
  referrer: User | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  walletBalance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

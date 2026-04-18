import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('login_history')
export class LoginHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', nullable: true, default: null })
  ip: string | null;

  @Column({ type: 'text', nullable: true, default: null })
  userAgent: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  browser: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  os: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  location: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

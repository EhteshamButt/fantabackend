import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum WithdrawalMethod {
  EASYPAISA = 'easypaisa',
  JAZZCASH = 'jazzcash',
}

export enum WithdrawalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class Withdrawal extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: WithdrawalMethod })
  method: WithdrawalMethod;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, unique: true, trim: true })
  trxId: string;

  @Prop({ required: true, enum: WithdrawalStatus, default: WithdrawalStatus.PENDING })
  status: WithdrawalStatus;
}

export const WithdrawalSchema = SchemaFactory.createForClass(Withdrawal);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class Payment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  packageId: string;

  @Prop({ required: true })
  packageName: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, trim: true })
  trxId: string;

  @Prop({ required: true, trim: true })
  senderNumber: string;

  @Prop({ required: true })
  screenshotUrl: string;

  @Prop({ required: true })
  screenshotPublicId: string;

  @Prop({ required: true, enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

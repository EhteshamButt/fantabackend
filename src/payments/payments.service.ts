import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Payment, PaymentStatus } from './payment.schema';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { Readable } from 'stream';

const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    private configService: ConfigService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  async submitPayment(
    userId: string,
    dto: SubmitPaymentDto,
    file: Express.Multer.File,
  ) {
    // Validate file
    if (!file) {
      throw new BadRequestException('Payment screenshot is required');
    }

    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Only JPG, JPEG, PNG files are accepted');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size must be under 5MB');
    }

    // Upload to Cloudinary via server-side signed upload (secret never exposed)
    const uploadResult = await this.uploadToCloudinary(file);

    // Save payment record
    const payment = await this.paymentModel.create({
      userId,
      packageId: dto.packageId,
      packageName: dto.packageName,
      amount: dto.amount,
      trxId: dto.trxId.trim(),
      senderNumber: dto.senderNumber.trim(),
      screenshotUrl: uploadResult.secure_url,
      screenshotPublicId: uploadResult.public_id,
      status: PaymentStatus.PENDING,
    });

    return {
      id: payment._id,
      packageName: payment.packageName,
      amount: payment.amount,
      status: payment.status,
      createdAt: (payment as any).createdAt,
    };
  }

  async getUserPayments(userId: string) {
    return this.paymentModel
      .find({ userId })
      .select('packageId packageName amount trxId senderNumber screenshotUrl status createdAt')
      .sort({ createdAt: -1 })
      .lean();
  }

  private uploadToCloudinary(file: Express.Multer.File): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'fantaearn/payments',
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png'],
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error || !result) {
            reject(new BadRequestException('Failed to upload screenshot'));
            return;
          }
          resolve(result);
        },
      );

      const stream = new Readable();
      stream.push(file.buffer);
      stream.push(null);
      stream.pipe(uploadStream);
    });
  }
}

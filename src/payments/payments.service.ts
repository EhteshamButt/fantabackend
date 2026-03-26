import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Payment, PaymentStatus } from './payment.entity';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { Readable } from 'stream';

const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
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
    if (!file) {
      throw new BadRequestException('Payment screenshot is required');
    }

    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Only JPG, JPEG, PNG files are accepted');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size must be under 5MB');
    }

    const uploadResult = await this.uploadToCloudinary(file);

    const payment = this.paymentRepo.create({
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
    await this.paymentRepo.save(payment);

    return {
      id: payment.id,
      packageName: payment.packageName,
      amount: payment.amount,
      status: payment.status,
      createdAt: payment.createdAt,
    };
  }

  async getUserPayments(userId: string) {
    return this.paymentRepo.find({
      where: { userId },
      select: ['id', 'packageId', 'packageName', 'amount', 'trxId', 'senderNumber', 'screenshotUrl', 'status', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
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

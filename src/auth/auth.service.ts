import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User, Role } from '../users/user.entity';
import { LoginHistory } from '../admin/login-history.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { randomBytes } from 'crypto';

const SALT_ROUNDS = 12;

function parseUserAgent(ua: string): { browser: string; os: string } {
  const uaLower = ua.toLowerCase();
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  if (uaLower.includes('mobile') || uaLower.includes('android')) {
    browser = 'Handheld Browser';
  } else if (uaLower.includes('chrome')) {
    browser = 'Chrome';
  } else if (uaLower.includes('firefox')) {
    browser = 'Firefox';
  } else if (uaLower.includes('safari')) {
    browser = 'Safari';
  } else if (uaLower.includes('edge')) {
    browser = 'Edge';
  }

  if (uaLower.includes('android')) {
    os = 'Android';
  } else if (uaLower.includes('iphone') || uaLower.includes('ipad')) {
    os = 'iOS';
  } else if (uaLower.includes('windows')) {
    os = 'Windows';
  } else if (uaLower.includes('mac')) {
    os = 'MacOS';
  } else if (uaLower.includes('linux')) {
    os = 'Linux';
  }

  return { browser, os };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(LoginHistory) private loginHistoryRepo: Repository<LoginHistory>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // Generate unique referral code for this user
    const referralCode = randomBytes(4).toString('hex').toUpperCase();

    // Link referrer if referral code provided
    let referredBy: string | null = null;
    if (dto.referralCode) {
      const referrer = await this.userRepo.findOne({
        where: { referralCode: dto.referralCode },
      });
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    const user = this.userRepo.create({
      email,
      password: hashedPassword,
      name: dto.name.trim(),
      phone: dto.phone?.trim() || null,
      role: Role.USER,
      referralCode,
      referredBy,
    });
    await this.userRepo.save(user);

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens,
    };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      await bcrypt.hash('dummy', SALT_ROUNDS);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    // Record login history
    const { browser, os } = parseUserAgent(userAgent || '');
    const loginRecord = new LoginHistory();
    loginRecord.userId = user.id;
    loginRecord.ip = ip || null;
    loginRecord.userAgent = userAgent || null;
    loginRecord.browser = browser;
    loginRecord.os = os;
    loginRecord.location = null;
    await this.loginHistoryRepo.save(loginRecord);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });

    if (!user || !user.refresh_token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValid = await bcrypt.compare(refreshToken, user.refresh_token);
    if (!isValid) {
      await this.userRepo.update(user.id, { refresh_token: null });
      throw new UnauthorizedException('Token reuse detected');
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      ...tokens,
    };
  }

  async logout(userId: string) {
    await this.userRepo.update(userId, { refresh_token: null });
    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'email', 'name', 'phone', 'role', 'referralCode', 'walletBalance', 'staffEarning', 'level', 'dailyLimit', 'createdAt'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async getTeam(userId: string) {
    const members = await this.userRepo.find({
      where: { referredBy: userId },
      select: ['id', 'email', 'name', 'level', 'createdAt'],
      order: { createdAt: 'DESC' },
    });

    const count = members.length;
    const thresholds = [3, 15, 45, 75, 170, 260, 350, 400, 435, 500, 800, 1000];
    let calculatedLevel = 0;
    for (let i = 0; i < thresholds.length; i++) {
      if (count >= thresholds[i]) calculatedLevel = i + 1;
      else break;
    }

    await this.userRepo.update(userId, { level: calculatedLevel });

    return { members, totalCount: count, calculatedLevel };
  }

  async getAllUsers() {
    return this.userRepo.find({
      select: ['id', 'email', 'name', 'phone', 'role', 'walletBalance', 'level', 'dailyLimit', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateUserRole(userId: string, role: Role) {
    const result = await this.userRepo.update(userId, { role });
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
    return this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'email', 'name', 'role', 'createdAt'],
    });
  }

  private async generateTokens(user: User) {
    const jti = randomBytes(16).toString('hex');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user.id, email: user.email, role: user.role, jti },
        {
          secret: this.configService.get<string>('ACCESS_TOKEN_SECRET'),
          expiresIn: (this.configService.get<string>('JWT_EXPIRATION') || '15m') as any,
        },
      ),
      this.jwtService.signAsync(
        { sub: user.id, type: 'refresh' },
        {
          secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
          expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d') as any,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepo.update(userId, { refresh_token: hashedToken });
  }
}

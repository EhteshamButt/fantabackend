import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto, Role } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { randomBytes } from 'crypto';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private supabase: SupabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const db = this.supabase.getClient();

    // Check if user already exists
    const { data: existing } = await db
      .from('users')
      .select('id')
      .eq('email', dto.email.toLowerCase().trim())
      .single();

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const { data: user, error } = await db
      .from('users')
      .insert({
        email: dto.email.toLowerCase().trim(),
        password: hashedPassword,
        name: dto.name.trim(),
        role: dto.role || Role.USER,
      })
      .select('id, email, name, role')
      .single();

    if (error) {
      throw new InternalServerErrorException('Failed to create user');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Store refresh token hash in DB
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return { user, ...tokens };
  }

  async login(dto: LoginDto) {
    const db = this.supabase.getClient();

    const { data: user, error } = await db
      .from('users')
      .select('id, email, name, role, password')
      .eq('email', dto.email.toLowerCase().trim())
      .single();

    // Use constant-time comparison approach: always hash even if user not found
    if (!user) {
      // Prevent timing attacks — hash a dummy password
      await bcrypt.hash('dummy', SALT_ROUNDS);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Store refresh token hash
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    // Strip password from response
    const { password: _, ...safeUser } = user;

    return { user: safeUser, ...tokens };
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const db = this.supabase.getClient();
    const { data: user } = await db
      .from('users')
      .select('id, email, name, role, refresh_token')
      .eq('id', payload.sub)
      .single();

    if (!user || !user.refresh_token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Verify stored refresh token hash matches
    const isValid = await bcrypt.compare(refreshToken, user.refresh_token);
    if (!isValid) {
      // Possible token theft — invalidate all sessions
      await db.from('users').update({ refresh_token: null }).eq('id', user.id);
      throw new UnauthorizedException('Token reuse detected');
    }

    const tokens = await this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    const { refresh_token: _, ...safeUser } = user;

    return { user: safeUser, ...tokens };
  }

  async logout(userId: string) {
    const db = this.supabase.getClient();
    await db.from('users').update({ refresh_token: null }).eq('id', userId);
    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const db = this.supabase.getClient();
    const { data: user } = await db
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('id', userId)
      .single();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async generateTokens(user: { id: string; email: string; role: string }) {
    const jti = randomBytes(16).toString('hex');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user.id, email: user.email, role: user.role, jti },
        { expiresIn: (this.configService.get<string>('JWT_EXPIRATION') || '15m') as any },
      ),
      this.jwtService.signAsync(
        { sub: user.id, type: 'refresh' },
        { expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d') as any },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    await this.supabase
      .getClient()
      .from('users')
      .update({ refresh_token: hashedToken })
      .eq('id', userId);
  }
}

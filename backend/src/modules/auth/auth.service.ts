import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshDurationDays = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePasswords(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateRawToken(): string {
    return crypto.randomBytes(48).toString('hex');
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email address already exists.',
      });
    }

    const passwordHash = await this.hashPassword(dto.password);
    const rawRefreshToken = this.generateRawToken();
    const hashedToken = this.hashToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshDurationDays * 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        sessions: {
          create: {
            hashedToken,
            familyId,
            expiresAt,
          },
        },
      },
      include: {
        sessions: true,
      },
    });

    const session = user.sessions[0];
    const accessToken = this.signAccessToken({
      sub: user.id,
      email: user.email,
      sessionId: session.id,
      familyId: session.familyId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await this.comparePasswords(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    const rawRefreshToken = this.generateRawToken();
    const hashedToken = this.hashToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshDurationDays * 24 * 60 * 60 * 1000);

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        hashedToken,
        familyId,
        expiresAt,
      },
    });

    const accessToken = this.signAccessToken({
      sub: user.id,
      email: user.email,
      sessionId: session.id,
      familyId: session.familyId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  async refresh(rawRefreshToken: string) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Refresh token is required.',
      });
    }

    const hashedToken = this.hashToken(rawRefreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { hashedToken },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token.',
      });
    }

    // Security Rule: Token Reuse Detection (BR-AUTH-02)
    // If an already revoked token is used, assume breach and revoke entire session family
    if (session.isRevoked) {
      this.logger.warn(
        `Token reuse attack detected for user ${session.userId} on family ${session.familyId}. Revoking all family sessions.`,
      );

      await this.prisma.userSession.updateMany({
        where: { familyId: session.familyId },
        data: { isRevoked: true },
      });

      throw new UnauthorizedException({
        code: 'TOKEN_REUSE_DETECTED',
        message: 'Security alert: Refresh token reuse detected. All sessions in this family have been invalidated.',
      });
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token has expired. Please sign in again.',
      });
    }

    // Rotate session: Revoke current session, issue new session in same family
    const newRawRefreshToken = this.generateRawToken();
    const newHashedToken = this.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + this.refreshDurationDays * 24 * 60 * 60 * 1000);

    const [, newSession] = await this.prisma.$transaction([
      this.prisma.userSession.update({
        where: { id: session.id },
        data: { isRevoked: true },
      }),
      this.prisma.userSession.create({
        data: {
          userId: session.userId,
          hashedToken: newHashedToken,
          familyId: session.familyId,
          expiresAt: newExpiresAt,
        },
      }),
    ]);

    const accessToken = this.signAccessToken({
      sub: session.user.id,
      email: session.user.email,
      sessionId: newSession.id,
      familyId: newSession.familyId,
    });

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        avatarUrl: session.user.avatarUrl,
        createdAt: session.user.createdAt,
      },
      accessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  async logout(sessionId: string) {
    if (!sessionId) return;
    await this.prisma.userSession.updateMany({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
  }

  async validateOAuthUser(profile: {
    email: string;
    name: string;
    avatarUrl: string | null;
  }) {
    if (!profile.email) {
      throw new UnauthorizedException('OAuth provider did not return a verified email address.');
    }

    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!user) {
      const dummyPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await this.hashPassword(dummyPassword);

      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          passwordHash,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
        },
      });
    }

    const rawRefreshToken = this.generateRawToken();
    const hashedToken = this.hashToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.refreshDurationDays * 24 * 60 * 60 * 1000);

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        hashedToken,
        familyId,
        expiresAt,
      },
    });

    const accessToken = this.signAccessToken({
      sub: user.id,
      email: user.email,
      sessionId: session.id,
      familyId: session.familyId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  private signAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }
}

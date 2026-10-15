import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
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
        isEmailVerified: false,
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

    // Create initial OTP verification challenge
    const initialRawOtp = crypto.randomInt(100000, 1000000).toString();
    const initialOtpHash = this.hashToken(initialRawOtp);
    await this.prisma.userOtpVerification.create({
      data: {
        userId: user.id,
        email: user.email,
        codeHash: initialOtpHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        resendAvailableAt: new Date(Date.now() + 60 * 1000), // 60 seconds
      },
    });

    this.logger.warn(
      `[AUTH_DELIVERY_DEFERRED] Verification challenge created for user ${user.id} (${user.email}). Outbound dispatch deferred: No external email provider configured in environment.`,
    );

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
        isEmailVerified: user.isEmailVerified,
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
        isEmailVerified: user.isEmailVerified,
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
        isEmailVerified: session.user.isEmailVerified,
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
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
    } else if (!user.isEmailVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
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
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException({
        code: 'INVALID_OTP_REQUEST',
        message: 'Invalid verification request.',
      });
    }

    if (user.isEmailVerified) {
      return {
        success: true,
        message: 'Email address is already verified.',
      };
    }

    const verification = await this.prisma.userOtpVerification.findFirst({
      where: {
        userId: user.id,
        purpose: 'EMAIL_VERIFICATION',
        isConsumed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification || verification.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'EXPIRED_OR_INVALID_OTP',
        message: 'The verification code has expired or is invalid. Please request a new code.',
      });
    }

    if (verification.attempts >= verification.maxAttempts) {
      throw new BadRequestException({
        code: 'OTP_MAX_ATTEMPTS_EXCEEDED',
        message: 'Maximum verification attempts exceeded. Please request a new code.',
      });
    }

    const inputHash = this.hashToken(dto.code);
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(verification.codeHash, 'hex'),
      Buffer.from(inputHash, 'hex'),
    );

    if (!isMatch) {
      const newAttempts = verification.attempts + 1;
      await this.prisma.userOtpVerification.update({
        where: { id: verification.id },
        data: {
          attempts: newAttempts,
          isConsumed: newAttempts >= verification.maxAttempts,
        },
      });

      const remaining = verification.maxAttempts - newAttempts;
      throw new BadRequestException({
        code: 'INVALID_OTP_CODE',
        message:
          remaining > 0
            ? `Invalid verification code. ${remaining} attempts remaining.`
            : 'Invalid verification code. Maximum attempts exceeded. Please request a new code.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userOtpVerification.update({
        where: { id: verification.id },
        data: {
          isConsumed: true,
          consumedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'USER_EMAIL_VERIFIED',
          metadata: { email: user.email },
        },
      });
    });

    return {
      success: true,
      message: 'Email address verified successfully.',
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Anti-enumeration defense: Always return consistent success response
    if (!user) {
      return {
        message: 'If this email address is registered, a new verification code has been dispatched.',
      };
    }

    if (user.isEmailVerified) {
      return {
        message: 'Email address is already verified.',
      };
    }

    const activeVerification = await this.prisma.userOtpVerification.findFirst({
      where: {
        userId: user.id,
        purpose: 'EMAIL_VERIFICATION',
        isConsumed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeVerification && activeVerification.resendAvailableAt > new Date()) {
      const secondsRemaining = Math.ceil(
        (activeVerification.resendAvailableAt.getTime() - Date.now()) / 1000,
      );
      throw new HttpException(
        {
          code: 'RESEND_COOLDOWN_ACTIVE',
          message: `Please wait ${secondsRemaining} seconds before requesting a new code.`,
          retryAfter: secondsRemaining,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.userOtpVerification.updateMany({
      where: {
        userId: user.id,
        purpose: 'EMAIL_VERIFICATION',
        isConsumed: false,
      },
      data: { isConsumed: true },
    });

    const rawCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = this.hashToken(rawCode);

    await this.prisma.userOtpVerification.create({
      data: {
        userId: user.id,
        email: user.email,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        resendAvailableAt: new Date(Date.now() + 60 * 1000), // 60 seconds
      },
    });

    this.logger.warn(
      `[AUTH_DELIVERY_DEFERRED] Resend OTP challenge created for user ${user.id} (${user.email}). Outbound dispatch deferred: No external email provider configured in environment.`,
    );

    return {
      message: 'If this email address is registered, a new verification code has been dispatched.',
    };
  }

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Anti-enumeration defense: Constant response regardless of account presence
    if (!user) {
      return {
        message: 'If an account with that email exists, password reset instructions have been sent.',
      };
    }

    // Rate-limiting check: 60s cooldown per user
    const recentReset = await this.prisma.userPasswordResetToken.findFirst({
      where: {
        userId: user.id,
        isUsed: false,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (!recentReset) {
      await this.prisma.userPasswordResetToken.updateMany({
        where: {
          userId: user.id,
          isUsed: false,
        },
        data: { isUsed: true },
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(rawToken);

      await this.prisma.userPasswordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        },
      });

      this.logger.warn(
        `[AUTH_DELIVERY_DEFERRED] Password reset token generated for user ${user.id}. Outbound dispatch deferred: No external email provider configured in environment.`,
      );
    }

    return {
      message: 'If an account with that email exists, password reset instructions have been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const resetRecord = await this.prisma.userPasswordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.isUsed || resetRecord.expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_RESET_TOKEN',
        message: 'The password reset token is invalid or has expired. Please request a new link.',
      });
    }

    const passwordHash = await this.hashPassword(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      // 1. Update user password
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash },
      });

      // 2. Mark token as consumed
      await tx.userPasswordResetToken.update({
        where: { id: resetRecord.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      });

      // 3. Security Defense: Revoke all active sessions and refresh tokens across all session families
      await tx.userSession.updateMany({
        where: { userId: resetRecord.userId },
        data: { isRevoked: true },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorUserId: resetRecord.userId,
          action: 'USER_PASSWORD_RESET',
          metadata: { method: 'EMAIL_RESET_TOKEN' },
        },
      });
    });

    return {
      success: true,
      message: 'Password has been reset successfully. Please sign in with your new password.',
    };
  }

  private signAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }
}

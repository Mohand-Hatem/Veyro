import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  applyDecorators,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';
import { AuthGuard } from '@nestjs/passport';
import { OAuthCallback, OAuthConfigured } from './guards/oauth.guards';

/** Per-IP brute-force protection: at most `limit` calls per minute to this route (each route has its own counter). */
const rateLimited = (limit: number) =>
  applyDecorators(UseGuards(ThrottlerGuard), Throttle({ default: { limit, ttl: 60_000 } }));

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @rateLimited(5)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);

    return { user: result.user };
  }

  @Public()
  @rateLimited(10)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);

    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ) {
    const rawRefreshToken =
      bodyRefreshToken || request.cookies?.refresh_token;

    const result = await this.authService.refresh(rawRefreshToken);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);

    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('sessionId') sessionId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(sessionId);
    this.clearAuthCookies(response);

    return {
      message: 'Logged out successfully.',
    };
  }

  /** CS-09: change the password while signed in. Other devices are signed out; this session continues. */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @CurrentUser('familyId') familyId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, familyId, dto);
  }

  @Get('me')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return {
      user,
    };
  }

  // --- OTP Verification ---
  @Public()
  @rateLimited(10)
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @rateLimited(5)
  @Post('otp/resend')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  // --- Password Recovery ---
  @Public()
  @rateLimited(5)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Public()
  @rateLimited(5)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // --- Google / GitHub sign-in ---
  // Start: redirects to the provider. Callback: the provider sends the person back here (through the Next.js proxy, so the
  // cookies below are first-party).
  @Public()
  @Get('google')
  @UseGuards(OAuthConfigured('google'), AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth consent screen redirect
  }

  @Public()
  @Get('google/callback')
  @UseGuards(OAuthConfigured('google'), OAuthCallback('google'))
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  @Public()
  @Get('github')
  @UseGuards(OAuthConfigured('github'), AuthGuard('github'))
  async githubAuth() {
    // Initiates GitHub OAuth consent screen redirect
  }

  @Public()
  @Get('github/callback')
  @UseGuards(OAuthConfigured('github'), OAuthCallback('github'))
  async githubAuthCallback(@Req() req: Request, @Res() res: Response) {
    return this.finishOAuth(req, res);
  }

  private async finishOAuth(req: Request, res: Response) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const profile = req.user as { email: string; name: string; avatarUrl: string | null } | false | undefined;
    if (!profile) return res.redirect(`${appUrl}/login?oauth=failed`);
    const result = await this.authService.validateOAuthUser(profile);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.redirect(`${appUrl}/${result.user.locale === 'AR' ? 'ar' : 'en'}/dashboard`);
  }

  // --- Helpers for Secure Cookies ---
  private setAuthCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProd = process.env.NODE_ENV === 'production';

    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/v1/auth/refresh', // Restricted path for refresh token cookie
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private clearAuthCookies(response: Response) {
    response.clearCookie('access_token');
    response.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
  }
}

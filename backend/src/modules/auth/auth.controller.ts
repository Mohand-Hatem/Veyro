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
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAuthCookies(response, result.accessToken, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
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

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
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

  @Get('me')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return {
      user,
    };
  }

  // --- Google OAuth ---
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth consent screen redirect
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const profile = req.user as any;
    const result = await this.authService.validateOAuthUser(profile);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    const redirectUrl = process.env.APP_URL || 'http://localhost:3000';
    return res.redirect(`${redirectUrl}/dashboard`);
  }

  // --- GitHub OAuth ---
  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  async githubAuth() {
    // Initiates GitHub OAuth consent screen redirect
  }

  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubAuthCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const profile = req.user as any;
    const result = await this.authService.validateOAuthUser(profile);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    const redirectUrl = process.env.APP_URL || 'http://localhost:3000';
    return res.redirect(`${redirectUrl}/dashboard`);
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

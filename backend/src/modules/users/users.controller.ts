import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Put, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { AvatarService } from './avatar.service';
import { UserDeletionService } from './user-deletion.service';
import { readAvatarBody } from './avatar-body';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetAvatarPresetDto } from './dto/set-avatar-preset.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/** The signed-in person's own profile (CS-09). There is deliberately no `:id`: nobody reads or edits another user here. */
@Controller('users/me')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly avatars: AvatarService,
    private readonly deletion: UserDeletionService,
  ) {}

  @Get('profile')
  getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch()
  updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  /**
   * The picture is the raw request body (Content-Type image/jpeg, image/png or image/webp, at most 2 MB). The server checks it is
   * really a picture, shrinks it to a small square WebP and stores only that. Rate limited like the other writes to storage.
   */
  @Put('avatar')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async setAvatar(@CurrentUser('id') userId: string, @Req() req: Request) {
    return this.avatars.upload(userId, await readAvatarBody(req));
  }

  /** Picks one of the five illustrated avatars (nothing to upload). */
  @Put('avatar/preset')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  setAvatarPreset(@CurrentUser('id') userId: string, @Body() dto: SetAvatarPresetDto) {
    return this.avatars.setPreset(userId, dto.key);
  }

  /** Back to initials. */
  @Delete('avatar')
  removeAvatar(@CurrentUser('id') userId: string) {
    return this.avatars.remove(userId);
  }

  /** Deletes the signed-in person's own account (step G2): confirmed with the password, anonymizes the user and signs them out everywhere. 10 tries an hour: each one costs a password check. */
  @Delete()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  async deleteAccount(@CurrentUser('id') userId: string, @Body() dto: DeleteAccountDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.deletion.deleteAccount(userId, dto.password);
    response.clearCookie('access_token');
    response.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
    return result;
  }
}

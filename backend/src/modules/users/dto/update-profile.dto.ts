import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserLocale, UserTheme } from '@prisma/client';
import { IsNotReservedName } from '../../../common/validators/reserved-name';

/**
 * `PATCH /users/me` (CS-09, ADR-016). Only these fields can be changed here. The email is identity, the password has its own
 * endpoint, and the avatar arrives with the storage step (an `avatarUrl` in the body is rejected as an unknown field).
 */
export class UpdateProfileDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long.' })
  @MaxLength(100, { message: 'Name must be at most 100 characters long.' })
  @IsNotReservedName()
  @IsOptional()
  name?: string;

  @IsEnum(UserLocale)
  @IsOptional()
  locale?: UserLocale;

  @IsEnum(UserTheme)
  @IsOptional()
  theme?: UserTheme;
}

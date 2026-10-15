import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Must provide a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsString({ message: 'Verification code must be a string.' })
  @IsNotEmpty({ message: 'Verification code is required.' })
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits.' })
  @Matches(/^\d{6}$/, { message: 'Verification code must contain only numeric digits.' })
  code: string;
}

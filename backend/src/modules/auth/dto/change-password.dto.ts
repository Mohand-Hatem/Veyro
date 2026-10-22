import { IsNotEmpty, IsString, MaxLength, MinLength, Matches } from 'class-validator';

/** `POST /auth/change-password` (CS-09). The new password follows the same rule as registration and reset. */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required.' })
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @MaxLength(128)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number or special character.',
  })
  newPassword: string;
}

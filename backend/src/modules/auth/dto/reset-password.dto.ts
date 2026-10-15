import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString({ message: 'Token must be a string.' })
  @IsNotEmpty({ message: 'Reset token is required.' })
  token: string;

  @IsString({ message: 'Password must be a string.' })
  @IsNotEmpty({ message: 'New password is required.' })
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain uppercase, lowercase, and at least one number or special character.',
  })
  newPassword: string;
}

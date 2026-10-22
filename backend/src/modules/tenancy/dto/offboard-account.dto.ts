import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/** Irreversible action: the owner proves identity (password) and intent (typing the account slug). */
export class OffboardAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'Password confirmation is required.' })
  @MaxLength(128)
  passwordConfirmation: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Type the account slug to confirm.' })
  @MaxLength(100)
  slugConfirmation: string;
}

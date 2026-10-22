import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches } from 'class-validator';
import { PROJECT_KEY_REGEX } from '../project-key';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /** Optional short code (2-5 chars, A-Z/0-9, starts with a letter). Generated from the name when omitted. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(PROJECT_KEY_REGEX, {
    message: 'Project key must be 2-5 characters (A-Z, 0-9) and start with a letter.',
  })
  key?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

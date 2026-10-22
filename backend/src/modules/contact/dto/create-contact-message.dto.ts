import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ContactTopic } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** `POST /contact` (CS-10, ADR-017): the public Contact us form. */
export class CreateContactMessageDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long.' })
  @MaxLength(100)
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(255)
  email: string;

  @IsEnum(ContactTopic)
  topic: ContactTopic;

  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'Message must be at least 10 characters long.' })
  @MaxLength(2000)
  message: string;

  /** Honeypot: hidden from people, filled by bots. A non-empty value is dropped silently. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

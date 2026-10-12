import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { AiMode, AiContextScope } from '@prisma/client';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsEnum(AiMode)
  @IsNotEmpty()
  mode: AiMode;

  @IsEnum(AiContextScope)
  @IsNotEmpty()
  contextScope: AiContextScope;

  @IsString()
  @IsOptional()
  workspaceId?: string;

  @IsString()
  @IsOptional()
  accountId?: string;
}

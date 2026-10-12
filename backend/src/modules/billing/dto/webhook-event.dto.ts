import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsObject,
} from 'class-validator';

export class WebhookEventDto {
  @IsString()
  @IsNotEmpty()
  externalEventId: string;

  @IsString()
  @IsNotEmpty()
  eventType: string;

  @IsInt()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, any>;
}

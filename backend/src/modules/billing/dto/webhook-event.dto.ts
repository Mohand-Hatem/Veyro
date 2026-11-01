import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsObject,
} from 'class-validator';

/** The fields billing reads from an event; each event type carries a different subset, so all are optional. */
export interface WebhookEventData {
  accountId?: string;
  userId?: string;
  tier?: string;
  status?: string;
  dailyQuota?: number;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
  billingCycleEndsAt?: string;
}

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
  data?: WebhookEventData;
}

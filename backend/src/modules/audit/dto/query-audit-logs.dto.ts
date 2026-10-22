import { IsOptional, IsString, IsInt, Min, Max, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAuditLogsDto {
  /** Account-level trail (CS-07): only the account's own events (billing, plan, offboarding). Account Owner only. */
  @IsString()
  @IsOptional()
  accountId?: string;

  @IsString()
  @IsOptional()
  workspaceId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  taskId?: string;

  /** One action or a comma-separated list (max 40), e.g. `TASK_CREATED,TASK_DELETED`. */
  @IsString()
  @IsOptional()
  action?: string;

  @IsString()
  @IsOptional()
  actorUserId?: string;

  /** Inclusive lower bound, ISO-8601 (CS-03). */
  @IsISO8601()
  @IsOptional()
  from?: string;

  /** Inclusive upper bound, ISO-8601. A date-only value (YYYY-MM-DD) covers that whole UTC day. */
  @IsISO8601()
  @IsOptional()
  to?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum MyTasksView {
  OPEN = 'open',
  DONE = 'done',
}

/** Due-date buckets of the open view (UTC days, same convention as the dashboard). */
export enum MyTasksBucket {
  OVERDUE = 'overdue',
  TODAY = 'today',
  UPCOMING = 'upcoming',
  NO_DATE = 'nodate',
}

/** Filters for `GET /workspaces/:workspaceId/my-tasks` (CS-08, ADR-015). */
export class QueryMyTasksDto {
  /** `open` = TODO, IN_PROGRESS, IN_REVIEW (default). `done` = DONE, newest first. */
  @IsEnum(MyTasksView)
  @IsOptional()
  view?: MyTasksView = MyTasksView.OPEN;

  /** Only for the open view. */
  @IsEnum(MyTasksBucket)
  @IsOptional()
  bucket?: MyTasksBucket;

  @IsString()
  @IsOptional()
  projectId?: string;

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

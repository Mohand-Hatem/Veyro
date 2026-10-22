import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ProjectLifecycleStatus } from '@prisma/client';

/** Filters for `GET /workspaces/:workspaceId/projects` (CS-08, ADR-015). All optional; without them the call behaves as before. */
export class QueryProjectsDto {
  /** Case-insensitive match on the project name or key. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;

  @IsEnum(ProjectLifecycleStatus)
  @IsOptional()
  status?: ProjectLifecycleStatus;

  /** `true` lists soft-deleted projects (workspace admins and the account owner only). */
  // Read the raw query value: the global pipe's implicit conversion would turn the string 'false' into true.
  @Transform(({ obj }) => (obj.deleted === 'true' ? true : obj.deleted === 'false' ? false : obj.deleted))
  @IsBoolean()
  @IsOptional()
  deleted?: boolean;
}

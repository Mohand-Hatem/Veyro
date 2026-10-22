import { IsOptional, IsEnum, IsString, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TaskPriority, TaskStatus, TaskCategory } from '@prisma/client';

export class QueryTasksDto {
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @IsEnum(TaskCategory)
  @IsOptional()
  category?: TaskCategory;

  @IsString()
  @IsOptional()
  assigneeId?: string;

  /** `true` lists soft-deleted tasks (the restore window) instead of active ones (CS-04). */
  // Read the raw query value: the global pipe's implicit conversion would turn the string 'false' into true.
  @Transform(({ obj }) => (obj.deleted === 'true' ? true : obj.deleted === 'false' ? false : obj.deleted))
  @IsBoolean()
  @IsOptional()
  deleted?: boolean;

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

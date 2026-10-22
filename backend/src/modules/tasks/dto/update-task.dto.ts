import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { TaskPriority, TaskStatus, TaskCategory } from '@prisma/client';

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  /** `null` clears the category (CS-05). */
  @IsEnum(TaskCategory)
  @IsOptional()
  category?: TaskCategory | null;

  @IsString()
  @IsOptional()
  assigneeId?: string | null;

  @IsDateString()
  @IsOptional()
  dueDate?: string | null;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;
}

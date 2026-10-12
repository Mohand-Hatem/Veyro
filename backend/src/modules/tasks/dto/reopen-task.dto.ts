import { IsString, IsNotEmpty, MinLength, MaxLength, IsEnum } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class ReopenTaskDto {
  @IsEnum(TaskStatus)
  @IsNotEmpty()
  targetStatus: TaskStatus;

  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Reopening reason must be at least 5 characters long.' })
  @MaxLength(1000)
  reason: string;
}

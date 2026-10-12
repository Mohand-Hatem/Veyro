import { IsString, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { ProjectLifecycleStatus } from '@prisma/client';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsEnum(ProjectLifecycleStatus)
  @IsOptional()
  lifecycleStatus?: ProjectLifecycleStatus;
}

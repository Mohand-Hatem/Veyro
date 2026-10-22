import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ProjectRole } from '@prisma/client';

export class AssignProjectMemberDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  /** Role in the project; defaults to MEMBER (CS-05). */
  @IsOptional()
  @IsEnum(ProjectRole)
  role?: ProjectRole;
}

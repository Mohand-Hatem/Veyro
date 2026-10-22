import { IsEmail, IsNotEmpty, IsEnum, IsOptional, IsArray, ArrayMaxSize, ArrayUnique, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { WorkspaceRole } from '@prisma/client';

export const MAX_INVITATION_PROJECTS = 25;

export class InviteMemberDto {
  @IsEmail({}, { message: 'Must provide a valid email address to invite.' })
  @IsNotEmpty({ message: 'Email is required.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email: string;

  @IsEnum(WorkspaceRole, {
    message: 'Role must be either ADMIN or MEMBER.',
  })
  role: WorkspaceRole = WorkspaceRole.MEMBER;

  /** Optional project pre-assignment applied when the invitation is accepted (MEMBER role only). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_INVITATION_PROJECTS)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  projectIds?: string[];
}

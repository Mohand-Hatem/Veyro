import { IsEmail, IsNotEmpty, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { WorkspaceRole } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail({}, { message: 'Must provide a valid email address to invite.' })
  @IsNotEmpty({ message: 'Email is required.' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  email: string;

  @IsEnum(WorkspaceRole, {
    message: 'Role must be either ADMIN or MEMBER.',
  })
  role: WorkspaceRole = WorkspaceRole.MEMBER;
}

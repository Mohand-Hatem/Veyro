import { IsEnum } from 'class-validator';
import { WorkspaceRole } from '@prisma/client';

export class ChangeMemberRoleDto {
  @IsEnum(WorkspaceRole, { message: 'Role must be either ADMIN or MEMBER.' })
  role: WorkspaceRole;
}

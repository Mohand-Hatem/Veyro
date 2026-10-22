import { IsEnum } from 'class-validator';
import { ProjectRole } from '@prisma/client';

export class UpdateProjectMemberRoleDto {
  @IsEnum(ProjectRole, { message: 'Role must be either ADMIN or MEMBER.' })
  role: ProjectRole;
}

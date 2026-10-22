import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { AssignProjectMemberDto } from './dto/assign-project-member.dto';
import { UpdateProjectMemberRoleDto } from './dto/update-project-member-role.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { ProjectAccessGuard } from './guards/project-access.guard';
import { ProjectAdminGuard } from './guards/project-admin.guard';
import { WorkspaceRole } from '@prisma/client';

@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('workspaces/:workspaceId/projects')
  @UseGuards(TenantGuard)
  async listWorkspaceProjects(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryProjectsDto,
    @Req() req: any,
  ) {
    const isPrivileged =
      req.isAccountOwner || req.workspaceRole === WorkspaceRole.ADMIN;
    return this.projectsService.listWorkspaceProjects(
      userId,
      workspaceId,
      isPrivileged,
      query,
    );
  }

  @Post('workspaces/:workspaceId/projects')
  @UseGuards(TenantGuard)
  @HttpCode(HttpStatus.CREATED)
  async createProject(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectDto,
    @Req() req: any,
  ) {
    const isPrivileged =
      req.isAccountOwner || req.workspaceRole === WorkspaceRole.ADMIN;
    if (!isPrivileged) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'Only workspace administrators or the account owner can create projects.',
      });
    }

    return this.projectsService.createProject(userId, workspaceId, dto);
  }

  @Get('projects/:id')
  @UseGuards(ProjectAccessGuard)
  async getProjectDetails(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Req() req: any,
  ) {
    return this.projectsService.getProjectDetails(projectId, {
      userId,
      isAdmin: Boolean(req.isProjectAdmin),
      isOverride: Boolean(req.isWorkspaceOverride),
      projectRole: req.projectRole,
    });
  }

  @Patch('projects/:id')
  @UseGuards(ProjectAccessGuard, ProjectAdminGuard)
  async updateProject(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: any,
  ) {
    return this.projectsService.updateProject(userId, projectId, dto, Boolean(req.isWorkspaceOverride));
  }

  @Delete('projects/:id')
  @UseGuards(ProjectAccessGuard, ProjectAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProject(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Req() req: any,
  ) {
    return this.projectsService.softDeleteProject(userId, projectId, Boolean(req.isWorkspaceOverride));
  }

  /** CS-08: deliberately without ProjectAccessGuard (it answers 404 for deleted projects); the service checks the caller. */
  @Post('projects/:id/restore')
  @HttpCode(HttpStatus.OK)
  async restoreProject(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
  ) {
    return this.projectsService.restoreProject(userId, projectId);
  }

  @Post('projects/:id/members')
  @UseGuards(ProjectAccessGuard, ProjectAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async assignMember(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Body() dto: AssignProjectMemberDto,
  ) {
    return this.projectsService.assignMember(userId, projectId, dto.userId, dto.role);
  }

  @Delete('projects/:id/members/:userId')
  @UseGuards(ProjectAccessGuard, ProjectAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Param('userId') targetUserId: string,
    @Req() req: any,
  ) {
    return this.projectsService.removeMember(userId, projectId, targetUserId, Boolean(req.isWorkspaceOverride));
  }

  @Patch('projects/:id/members/:userId')
  @UseGuards(ProjectAccessGuard, ProjectAdminGuard)
  async updateMemberRole(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateProjectMemberRoleDto,
    @Req() req: any,
  ) {
    return this.projectsService.updateMemberRole(userId, projectId, targetUserId, dto.role, Boolean(req.isWorkspaceOverride));
  }

  @Get('projects/:id/members')
  @UseGuards(ProjectAccessGuard)
  async listProjectMembers(@Param('id') projectId: string) {
    return this.projectsService.listProjectMembers(projectId);
  }
}

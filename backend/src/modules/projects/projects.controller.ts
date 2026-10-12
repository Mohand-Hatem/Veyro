import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AssignProjectMemberDto } from './dto/assign-project-member.dto';
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
    @Req() req: any,
  ) {
    const isPrivileged =
      req.isAccountOwner || req.workspaceRole === WorkspaceRole.ADMIN;
    return this.projectsService.listWorkspaceProjects(
      userId,
      workspaceId,
      isPrivileged,
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
  async getProjectDetails(@Param('id') projectId: string) {
    return this.projectsService.getProjectDetails(projectId);
  }

  @Patch('projects/:id')
  @UseGuards(ProjectAccessGuard, ProjectAdminGuard)
  async updateProject(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(userId, projectId, dto);
  }

  @Delete('projects/:id')
  @UseGuards(ProjectAccessGuard, ProjectAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProject(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
  ) {
    return this.projectsService.softDeleteProject(userId, projectId);
  }

  @Post('projects/:id/members')
  @UseGuards(ProjectAccessGuard, ProjectAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async assignMember(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Body() dto: AssignProjectMemberDto,
  ) {
    return this.projectsService.assignMember(userId, projectId, dto.userId);
  }

  @Delete('projects/:id/members/:userId')
  @UseGuards(ProjectAccessGuard, ProjectAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser('id') userId: string,
    @Param('id') projectId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.projectsService.removeMember(userId, projectId, targetUserId);
  }

  @Get('projects/:id/members')
  @UseGuards(ProjectAccessGuard)
  async listProjectMembers(@Param('id') projectId: string) {
    return this.projectsService.listProjectMembers(projectId);
  }
}

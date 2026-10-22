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
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReopenTaskDto } from './dto/reopen-task.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { QueryMyTasksDto } from './dto/query-my-tasks.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectAccessGuard } from '../projects/guards/project-access.guard';
import { TaskAccessGuard } from './guards/task-access.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { WorkspaceRole } from '@prisma/client';

@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /** CS-08: the caller's assigned tasks across the projects of one workspace. */
  @Get('workspaces/:workspaceId/my-tasks')
  @UseGuards(TenantGuard)
  async listMyTasks(
    @CurrentUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryMyTasksDto,
    @Req() req: any,
  ) {
    const isPrivileged = Boolean(req.isAccountOwner) || req.workspaceRole === WorkspaceRole.ADMIN;
    return this.tasksService.listMyTasks(userId, workspaceId, isPrivileged, query);
  }

  @Post('projects/:projectId/tasks')
  @UseGuards(ProjectAccessGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTask(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @Req() req: any,
  ) {
    return this.tasksService.createTask(userId, projectId, dto, Boolean(req.isProjectAdmin));
  }

  @Get('projects/:projectId/tasks')
  @UseGuards(ProjectAccessGuard)
  async listProjectTasks(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Query() query: QueryTasksDto,
    @Req() req: any,
  ) {
    return this.tasksService.listProjectTasks(projectId, query, { userId, isAdmin: Boolean(req.isProjectAdmin) });
  }

  @Get('tasks/:id')
  @UseGuards(TaskAccessGuard)
  async getTaskDetails(
    @CurrentUser('id') userId: string,
    @Param('id') taskId: string,
    @Req() req: any,
  ) {
    return this.tasksService.getTaskDetails(taskId, {
      userId,
      isAdmin: Boolean(req.isProjectAdmin),
      isAuthor: Boolean(req.isTaskAuthor),
    });
  }

  @Patch('tasks/:id')
  @UseGuards(TaskAccessGuard)
  async updateTask(
    @CurrentUser('id') userId: string,
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: any,
  ) {
    return this.tasksService.updateTask(userId, taskId, dto, Boolean(req.isProjectAdmin));
  }

  @Post('tasks/:id/reopen')
  @UseGuards(TaskAccessGuard)
  @HttpCode(HttpStatus.OK)
  async reopenTask(
    @CurrentUser('id') userId: string,
    @Param('id') taskId: string,
    @Body() dto: ReopenTaskDto,
    @Req() req: any,
  ) {
    return this.tasksService.reopenTask(
      userId,
      taskId,
      dto,
      Boolean(req.isProjectAdmin),
    );
  }

  @Post('tasks/:id/comments')
  @UseGuards(TaskAccessGuard)
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @CurrentUser('id') userId: string,
    @Param('id') taskId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.tasksService.createComment(userId, taskId, dto);
  }

  @Get('tasks/:id/comments')
  @UseGuards(TaskAccessGuard)
  async listTaskComments(@Param('id') taskId: string) {
    return this.tasksService.listTaskComments(taskId);
  }

  @Delete('tasks/:id')
  @UseGuards(TaskAccessGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(
    @CurrentUser('id') userId: string,
    @Param('id') taskId: string,
    @Req() req: any,
  ) {
    return this.tasksService.softDeleteTask(
      userId,
      taskId,
      Boolean(req.isProjectAdmin),
    );
  }

  @Post('tasks/:id/restore')
  @UseGuards(TaskAccessGuard)
  @HttpCode(HttpStatus.OK)
  async restoreTask(
    @CurrentUser('id') userId: string,
    @Param('id') taskId: string,
    @Req() req: any,
  ) {
    return this.tasksService.restoreTask(
      userId,
      taskId,
      Boolean(req.isProjectAdmin),
    );
  }
}

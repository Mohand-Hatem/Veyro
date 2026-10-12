import {
  Controller,
  Post,
  Get,
  Patch,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectAccessGuard } from '../projects/guards/project-access.guard';
import { TaskAccessGuard } from './guards/task-access.guard';

@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('projects/:projectId/tasks')
  @UseGuards(ProjectAccessGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTask(
    @CurrentUser('id') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.createTask(userId, projectId, dto);
  }

  @Get('projects/:projectId/tasks')
  @UseGuards(ProjectAccessGuard)
  async listProjectTasks(
    @Param('projectId') projectId: string,
    @Query() query: QueryTasksDto,
  ) {
    return this.tasksService.listProjectTasks(projectId, query);
  }

  @Get('tasks/:id')
  @UseGuards(TaskAccessGuard)
  async getTaskDetails(@Param('id') taskId: string) {
    return this.tasksService.getTaskDetails(taskId);
  }

  @Patch('tasks/:id')
  @UseGuards(TaskAccessGuard)
  async updateTask(
    @CurrentUser('id') userId: string,
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(userId, taskId, dto);
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
}

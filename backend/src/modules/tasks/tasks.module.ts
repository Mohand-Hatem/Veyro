import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskAccessGuard } from './guards/task-access.guard';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [ProjectsModule],
  controllers: [TasksController],
  providers: [TasksService, TaskAccessGuard],
  exports: [TasksService, TaskAccessGuard],
})
export class TasksModule {}

import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskAccessGuard } from './guards/task-access.guard';
import { ProjectsModule } from '../projects/projects.module';
import { StorageModule } from '../storage/storage.module';
import { TaskAttachmentsService } from './task-attachments.service';

@Module({
  imports: [ProjectsModule, StorageModule],
  controllers: [TasksController],
  providers: [TasksService, TaskAccessGuard, TaskAttachmentsService],
  exports: [TasksService, TaskAccessGuard],
})
export class TasksModule {}

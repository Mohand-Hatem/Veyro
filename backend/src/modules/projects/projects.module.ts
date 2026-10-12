import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectAccessGuard } from './guards/project-access.guard';
import { ProjectAdminGuard } from './guards/project-admin.guard';
import { TenancyModule } from '../tenancy/tenancy.module';

@Module({
  imports: [TenancyModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectAccessGuard, ProjectAdminGuard],
  exports: [ProjectsService, ProjectAccessGuard],
})
export class ProjectsModule {}

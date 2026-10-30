import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module';
import { UsersModule } from '../users/users.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [TenancyModule, UsersModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}

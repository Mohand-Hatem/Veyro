import { Module } from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { WorkspaceManagementService } from './workspace-management.service';
import { AccountPurgeService } from './account-purge.service';
import { TenancyController } from './tenancy.controller';
import { TenantGuard } from './guards/tenant.guard';
import { AccountOwnerGuard } from './guards/account-owner.guard';

@Module({
  controllers: [TenancyController],
  providers: [TenancyService, WorkspaceManagementService, AccountPurgeService, TenantGuard, AccountOwnerGuard],
  exports: [TenancyService, AccountPurgeService, TenantGuard, AccountOwnerGuard],
})
export class TenancyModule {}

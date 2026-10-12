import { Module } from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { TenancyController } from './tenancy.controller';
import { TenantGuard } from './guards/tenant.guard';
import { AccountOwnerGuard } from './guards/account-owner.guard';

@Module({
  controllers: [TenancyController],
  providers: [TenancyService, TenantGuard, AccountOwnerGuard],
  exports: [TenancyService, TenantGuard, AccountOwnerGuard],
})
export class TenancyModule {}

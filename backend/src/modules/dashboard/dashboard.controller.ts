import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { DashboardService } from './dashboard.service';

@Controller()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** docs/06 §2.3.1 — role-aware aggregate read model for the workspace dashboard. */
  @Get('workspaces/:workspaceId/dashboard')
  @UseGuards(TenantGuard)
  async getDashboard(@CurrentUser('id') userId: string, @Param('workspaceId') workspaceId: string) {
    return this.dashboardService.getDashboard(userId, workspaceId);
  }
}

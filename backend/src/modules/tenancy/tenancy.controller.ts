import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { WorkspaceManagementService } from './workspace-management.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { ChangeMemberRoleDto } from './dto/change-member-role.dto';
import { AtomicOnboardingDto } from './dto/atomic-onboarding.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { PreviewInvitationDto } from './dto/preview-invitation.dto';
import { OffboardAccountDto } from './dto/offboard-account.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TenantGuard } from './guards/tenant.guard';
import { AccountOwnerGuard } from './guards/account-owner.guard';
import { WorkspaceRole } from '@prisma/client';

@Controller()
export class TenancyController {
  constructor(
    private readonly tenancyService: TenancyService,
    private readonly management: WorkspaceManagementService,
  ) {}

  @Post('onboarding/atomic')
  @HttpCode(HttpStatus.CREATED)
  async atomicOnboarding(
    @CurrentUser('id') userId: string,
    @Body() dto: AtomicOnboardingDto,
  ) {
    return this.tenancyService.atomicOnboarding(userId, dto);
  }

  @Post('accounts/:id/workspaces')
  @UseGuards(AccountOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  async createWorkspace(
    @CurrentUser('id') userId: string,
    @Param('id') accountId: string,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.tenancyService.createWorkspace(userId, accountId, dto);
  }

  @Post('accounts/:id/offboard')
  @UseGuards(AccountOwnerGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async initiateOffboarding(
    @CurrentUser('id') userId: string,
    @Param('id') accountId: string,
    @Body() dto: OffboardAccountDto,
  ) {
    return this.tenancyService.initiateAccountOffboarding(userId, accountId, dto);
  }

  @Get('workspaces')
  async listWorkspaces(@CurrentUser('id') userId: string) {
    return this.tenancyService.listUserWorkspaces(userId);
  }

  @Get('workspaces/:id')
  @UseGuards(TenantGuard)
  async getWorkspaceDetails(@Param('id') workspaceId: string) {
    return this.tenancyService.getWorkspaceDetails(workspaceId);
  }

  @Post('workspaces/:id/invitations')
  @UseGuards(TenantGuard)
  @HttpCode(HttpStatus.CREATED)
  async inviteMember(
    @CurrentUser('id') inviterId: string,
    @Param('id') workspaceId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.tenancyService.inviteMember(inviterId, workspaceId, dto);
  }

  /** CS-11 / ADR-018: what the invitation page shows before the person accepts. Read-only; never changes the invitation. */
  @Get('invitations/preview')
  async previewInvitation(@CurrentUser() user: AuthenticatedUser, @Query() query: PreviewInvitationDto) {
    return this.tenancyService.previewInvitation(user.email, query.token);
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.tenancyService.acceptInvitation(user.id, user.email, dto);
  }

  @Get('workspaces/:id/members')
  @UseGuards(TenantGuard)
  async listMembers(@Param('id') workspaceId: string) {
    return this.tenancyService.listWorkspaceMembers(workspaceId);
  }

  /* ---- CS-02: workspace administration (Admin / Account Owner, enforced in the service) ---- */

  @Patch('workspaces/:id')
  @UseGuards(TenantGuard)
  async updateWorkspace(
    @CurrentUser('id') userId: string,
    @Param('id') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.management.updateWorkspace(userId, workspaceId, dto);
  }

  @Patch('workspaces/:id/members/:memberId')
  @UseGuards(TenantGuard)
  async changeMemberRole(
    @CurrentUser('id') userId: string,
    @Param('id') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() dto: ChangeMemberRoleDto,
  ) {
    return this.management.changeMemberRole(userId, workspaceId, memberId, dto);
  }

  @Delete('workspaces/:id/members/:memberId')
  @UseGuards(TenantGuard)
  async removeMember(
    @CurrentUser('id') userId: string,
    @Param('id') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.management.removeMember(userId, workspaceId, memberId);
  }

  @Get('workspaces/:id/invitations')
  @UseGuards(TenantGuard)
  async listInvitations(@CurrentUser('id') userId: string, @Param('id') workspaceId: string) {
    return this.management.listInvitations(userId, workspaceId);
  }

  @Post('workspaces/:id/invitations/:invitationId/revoke')
  @UseGuards(TenantGuard)
  @HttpCode(HttpStatus.OK)
  async revokeInvitation(
    @CurrentUser('id') userId: string,
    @Param('id') workspaceId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.management.revokeInvitation(userId, workspaceId, invitationId);
  }

  @Post('workspaces/:id/invitations/:invitationId/resend')
  @UseGuards(TenantGuard)
  @HttpCode(HttpStatus.OK)
  async resendInvitation(
    @CurrentUser('id') userId: string,
    @Param('id') workspaceId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.management.resendInvitation(userId, workspaceId, invitationId);
  }
}

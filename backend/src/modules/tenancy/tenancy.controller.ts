import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { TenancyService } from './tenancy.service';
import { AtomicOnboardingDto } from './dto/atomic-onboarding.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TenantGuard } from './guards/tenant.guard';
import { AccountOwnerGuard } from './guards/account-owner.guard';
import { WorkspaceRole } from '@prisma/client';

@Controller()
export class TenancyController {
  constructor(private readonly tenancyService: TenancyService) {}

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
  ) {
    return this.tenancyService.initiateAccountOffboarding(userId, accountId);
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
}

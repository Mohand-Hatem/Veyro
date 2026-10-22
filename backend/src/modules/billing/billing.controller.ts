import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { WebhookEventDto } from './dto/webhook-event.dto';
import { SelectActiveProjectsDto } from './dto/select-active-projects.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AccountOwnerGuard } from '../tenancy/guards/account-owner.guard';

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('accounts/:id/subscription')
  @UseGuards(AccountOwnerGuard)
  async getAccountSubscription(@Param('id') accountId: string) {
    return this.billingService.getAccountSubscription(accountId);
  }

  @Get('accounts/:id/billing-events')
  @UseGuards(AccountOwnerGuard)
  async listBillingEvents(@Param('id') accountId: string) {
    return this.billingService.listBillingEvents(accountId);
  }

  @Get('accounts/:id/projects')
  @UseGuards(AccountOwnerGuard)
  async listAccountProjects(@Param('id') accountId: string) {
    return this.billingService.listAccountProjects(accountId);
  }

  @Get('users/me/ai-subscription')
  async getUserAiSubscription(@CurrentUser('id') userId: string) {
    return this.billingService.getUserAiSubscription(userId);
  }

  @Post('billing/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() dto: WebhookEventDto) {
    return this.billingService.handleWebhook(dto);
  }

  @Post('accounts/:id/select-active-projects')
  @UseGuards(AccountOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async selectActiveProjects(
    @CurrentUser('id') userId: string,
    @Param('id') accountId: string,
    @Body() dto: SelectActiveProjectsDto,
  ) {
    return this.billingService.selectActiveProjects(userId, accountId, dto);
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';
import { CheckoutDto } from './dto/checkout.dto';
import { SelectActiveProjectsDto } from './dto/select-active-projects.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AccountOwnerGuard } from '../tenancy/guards/account-owner.guard';

@Controller()
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly stripe: StripeService,
    private readonly stripeWebhook: StripeWebhookService,
  ) {}

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

  /** Public on purpose (Stripe calls it) and protected by the Stripe signature over the raw request body. */
  @Post('billing/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    return this.stripeWebhook.process(this.stripe.verifyEvent(req.rawBody, signature));
  }

  @Post('accounts/:id/billing/checkout')
  @UseGuards(AccountOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async startCheckout(@CurrentUser('id') userId: string, @Param('id') accountId: string, @Body() dto: CheckoutDto) {
    return this.billingService.startCheckout(userId, accountId, dto.tier);
  }

  @Post('accounts/:id/billing/change-plan')
  @UseGuards(AccountOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async changePlan(@Param('id') accountId: string, @Body() dto: CheckoutDto) {
    return this.billingService.changePlan(accountId, dto.tier);
  }

  @Post('accounts/:id/billing/portal')
  @UseGuards(AccountOwnerGuard)
  @HttpCode(HttpStatus.OK)
  async startPortal(@CurrentUser('id') userId: string, @Param('id') accountId: string) {
    return this.billingService.startPortal(userId, accountId);
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

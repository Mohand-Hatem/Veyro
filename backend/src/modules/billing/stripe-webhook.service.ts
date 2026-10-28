import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';
import { WebhookEventDto } from './dto/webhook-event.dto';

/**
 * Turns a verified Stripe event into one of our billing events.
 *
 * Stripe may deliver events out of order and more than once, so an event is only a hint that "this subscription changed":
 * the current state is fetched from Stripe and applied (the latest state always wins), and duplicates are dropped by the event
 * id in BillingService.applyBillingEvent.
 */
@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly billing: BillingService,
  ) {}

  async process(event: Stripe.Event) {
    const subscriptionId = this.subscriptionIdOf(event);
    if (!subscriptionId) return { received: true, ignored: true };

    const subscription = await this.stripe.retrieveSubscription(subscriptionId);
    const dto = this.toBillingEvent(event, subscription);
    if (!dto) return { received: true, ignored: true };
    return this.billing.applyBillingEvent(dto);
  }

  /** Which subscription an event is about, for the few event types we care about. */
  subscriptionIdOf(event: Stripe.Event): string | null {
    const o = event.data.object as unknown as Record<string, any>;
    const id = (v: unknown) => (typeof v === 'string' ? v : (v as { id?: string } | null)?.id ?? null);
    switch (event.type) {
      case 'checkout.session.completed':
        return o.mode === 'subscription' ? id(o.subscription) : null;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return id(o.id);
      case 'invoice.paid':
      case 'invoice.payment_failed':
        return id(o.parent?.subscription_details?.subscription ?? o.subscription);
      default:
        return null;
    }
  }

  toBillingEvent(event: Stripe.Event, sub: Stripe.Subscription): WebhookEventDto | null {
    const accountId = sub.metadata?.accountId;
    if (!accountId) {
      this.logger.error(`Subscription ${sub.id} has no accountId metadata: event ${event.id} ignored.`);
      return null;
    }
    const item = sub.items.data[0] as unknown as { price?: { id: string }; current_period_end?: number } | undefined;
    const tier = this.stripe.tierOfPrice(item?.price?.id);
    if (!tier) {
      this.logger.error(`Subscription ${sub.id} uses a price that is not one of our plans: event ${event.id} ignored.`);
      return null;
    }

    let state: { tier: string; status: string };
    switch (sub.status) {
      case 'active':
      case 'trialing':
        state = { tier, status: 'ACTIVE' };
        break;
      case 'past_due':
      case 'unpaid':
        state = { tier, status: 'PAST_DUE' };
        break;
      case 'canceled':
      case 'incomplete_expired':
        state = { tier: 'FREE', status: 'DOWNGRADED' };
        break;
      default:
        return null; // incomplete, paused: nothing to apply yet
    }

    const invoice = event.type.startsWith('invoice.') ? (event.data.object as unknown as { amount_paid?: number; amount_due?: number; currency?: string }) : undefined;
    const periodEnd = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
    return {
      externalEventId: event.id,
      eventType: event.type,
      ...(invoice ? { amount: event.type === 'invoice.paid' ? invoice.amount_paid : invoice.amount_due, currency: invoice.currency } : {}),
      data: {
        accountId,
        ...state,
        // The portal ends a plan by setting a cancel date (`cancel_at`) and leaves `cancel_at_period_end` false; the API flag is the other way.
        cancelAtPeriodEnd: sub.cancel_at_period_end || sub.cancel_at != null,
        billingCycleEndsAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
        providerCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        providerSubscriptionId: sub.id,
      },
    };
  }
}

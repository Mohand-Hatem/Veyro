import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';
import { SubscriptionPlanTier } from '@prisma/client';

export type PaidTier = Exclude<SubscriptionPlanTier, 'FREE'>;
export const PAID_TIERS: PaidTier[] = ['PRO', 'ENTERPRISE', 'EPIC'];

const notConfigured = () =>
  new ServiceUnavailableException({ code: 'BILLING_NOT_CONFIGURED', message: 'Online payments are not set up yet.' });

/** The only place that talks to Stripe. Everything it needs comes from the environment, so tests can swap it out whole. */
@Injectable()
export class StripeService {
  private client?: Stripe;

  private api(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw notConfigured();
    return (this.client ??= new Stripe(key));
  }

  priceId(tier: PaidTier): string {
    const id = process.env[`STRIPE_PRICE_ID_${tier}`];
    if (!id) throw notConfigured();
    return id;
  }

  /** Which of our plans a Stripe price belongs to, or null for a price we never sold (a configuration mistake). */
  tierOfPrice(priceId: string | undefined): PaidTier | null {
    return PAID_TIERS.find((t) => process.env[`STRIPE_PRICE_ID_${t}`] === priceId) ?? null;
  }

  /**
   * Checks that a webhook really comes from Stripe: HMAC-SHA256 over the timestamp and the raw body, rejected after 5 minutes.
   * With no secret configured the endpoint is closed to everyone.
   */
  verifyEvent(rawBody: Buffer | undefined, signature: string | undefined): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw notConfigured();
    if (!rawBody || !signature) {
      throw new BadRequestException({ code: 'INVALID_SIGNATURE', message: 'Missing webhook signature.' });
    }
    try {
      return Stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException({ code: 'INVALID_SIGNATURE', message: 'Webhook signature could not be verified.' });
    }
  }

  retrieveSubscription(id: string): Promise<Stripe.Subscription> {
    return this.api().subscriptions.retrieve(id);
  }

  /** Hosted checkout page for a new subscription. The account id travels on the subscription so every later event can find it. */
  async checkoutUrl(a: { accountId: string; tier: PaidTier; customerId: string | null; email: string; successUrl: string; cancelUrl: string }): Promise<string> {
    const session = await this.api().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: this.priceId(a.tier), quantity: 1 }],
      client_reference_id: a.accountId,
      metadata: { accountId: a.accountId, tier: a.tier },
      subscription_data: { metadata: { accountId: a.accountId, tier: a.tier } },
      ...(a.customerId ? { customer: a.customerId } : { customer_email: a.email }),
      success_url: a.successUrl,
      cancel_url: a.cancelUrl,
    });
    if (!session.url) throw new ServiceUnavailableException({ code: 'CHECKOUT_UNAVAILABLE', message: 'Could not start checkout. Try again.' });
    return session.url;
  }

  /**
   * Moves a subscription to another plan by swapping the price on its single item. Stripe prorates (charges or credits the
   * difference now); if that payment fails the whole change is refused instead of leaving the subscription half-changed.
   */
  async changePlan(subscriptionId: string, tier: PaidTier): Promise<void> {
    const api = this.api();
    const sub = await api.subscriptions.retrieve(subscriptionId);
    await api.subscriptions.update(subscriptionId, {
      items: [{ id: sub.items.data[0].id, price: this.priceId(tier) }],
      proration_behavior: 'create_prorations',
      payment_behavior: 'error_if_incomplete',
      metadata: { tier },
    });
  }

  /** Stripe's hosted page where the customer updates the card, reads invoices or cancels. */
  async portalUrl(customerId: string, returnUrl: string): Promise<string> {
    const configuration = process.env.STRIPE_PORTAL_CONFIG_ID;
    const session = await this.api().billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      ...(configuration ? { configuration } : {}),
    });
    return session.url;
  }
}

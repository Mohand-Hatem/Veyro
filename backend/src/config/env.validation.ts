import { Logger } from '@nestjs/common';

const MIN_JWT_SECRET_LENGTH = 32;

/** Refuses to boot with a missing or guessable JWT secret (runs once, from ConfigModule.forRoot({ validate })). */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const secret = config.JWT_SECRET;
  const fix = 'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))" and set it in backend/.env.';

  if (typeof secret !== 'string' || secret.trim() === '') {
    throw new Error(`JWT_SECRET is not set. ${fix}`);
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters. ${fix}`);
  }
  // Both strings are public: the old source-code fallback and the .env.example placeholder.
  if (secret.startsWith('veyro-super-secret-dev-key') || secret.startsWith('replace-with')) {
    throw new Error(`JWT_SECRET is still a published placeholder. ${fix}`);
  }

  // In production a missing sender means sign-up codes and invitations silently never arrive.
  if (config.NODE_ENV === 'production') {
    if (!config.RESEND_API_KEY || !config.EMAIL_FROM) {
      throw new Error('RESEND_API_KEY and EMAIL_FROM must be set in production (email delivery).');
    }
    if (String(config.EMAIL_FROM).includes('@resend.dev')) {
      // The test sender only reaches the owner of the Resend account. A portfolio demo without a domain may run on it, but only by saying so.
      if (config.RESEND_ALLOW_TEST_SENDER !== 'true') {
        throw new Error('EMAIL_FROM still uses the Resend test sender (@resend.dev), which only delivers to the Resend account owner. Verify a domain and use it, or set RESEND_ALLOW_TEST_SENDER=true for a demo.');
      }
      new Logger('Config').warn('Demo mode: emails use the Resend test sender, so only the Resend account owner receives them (sign-up codes and invitations to other people will not arrive).');
    }
  }

  // Payments: in production the webhook must be able to verify signatures, every plan needs a price, and test keys are refused.
  if (config.NODE_ENV === 'production') {
    for (const key of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_PRO', 'STRIPE_PRICE_ID_ENTERPRISE', 'STRIPE_PRICE_ID_EPIC']) {
      if (!config[key]) throw new Error(`${key} must be set in production (payments).`);
    }
    // A portfolio demo may run on Stripe's test mode when deployed, but only by saying so: otherwise a test key in production is a mistake.
    if (/_test_/.test(String(config.STRIPE_SECRET_KEY)) && config.STRIPE_ALLOW_TEST_KEYS !== 'true') {
      throw new Error('STRIPE_SECRET_KEY is a test key. Use the live key in production, or set STRIPE_ALLOW_TEST_KEYS=true for a demo with no real charges.');
    }
  }

  // The assistant: without a key production would silently answer with the development stand-in text.
  if (config.NODE_ENV === 'production' && !config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY must be set in production (AI assistant).');
  }

  // Profile photos: without storage the Profile page would offer an upload that can never work.
  if (config.NODE_ENV === 'production') {
    for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
      if (!config[key]) throw new Error(`${key} must be set in production (profile photos).`);
    }
  }

  // The daily cleanup (removed photos, old notifications, deleted accounts) refuses every call without this secret, so a forgotten value would mean nothing is ever cleaned.
  if (config.NODE_ENV === 'production' && String(config.CRON_SECRET ?? '').length < 16) {
    throw new Error('CRON_SECRET must be set in production (at least 16 characters): it protects the daily cleanup endpoint.');
  }
  return config;
}

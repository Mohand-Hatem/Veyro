// Preloaded by every test script (ts-node -r): the suites load backend/.env, which holds the real Resend key, and would
// otherwise send real mail to fake @veyro-test.io addresses (burning the daily quota and bouncing). dotenv and Nest's
// ConfigModule never override a variable that already exists, so setting them empty here wins.
process.env.RESEND_API_KEY = '';
process.env.EMAIL_FROM = '';
process.env.CONTACT_INBOX = '';
// Same reason for the AI key (no suite may call the real model; p58 fakes the gateway) and for payments: no suite may talk to the real Stripe account. Suites that test billing set what they need themselves.
for (const key of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_PRO', 'STRIPE_PRICE_ID_ENTERPRISE', 'STRIPE_PRICE_ID_EPIC', 'STRIPE_PORTAL_CONFIG_ID', 'GEMINI_API_KEY', 'AI_MODEL', 'AI_EMBEDDING_MODEL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_FOLDER']) {
  process.env[key] = '';
}

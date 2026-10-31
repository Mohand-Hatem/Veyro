import { execSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';

export const WORKSPACE = 'acme-studio';
const DEMO = { owner: /Layla Hassan/, admin: /Omar Nasser/, member: /Mona Adel/ } as const;

/** Signs in through the "Try the demo" menu on the login page, the way a visitor of the live demo does. */
export async function signInAsDemo(page: Page, who: keyof typeof DEMO) {
  await page.goto('/en/login');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await page.getByRole('button', { name: DEMO[who] }).click();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/en\/dashboard/);
}

/**
 * The stack runs the API with DEV_OUTBOX=true, which prints the sign-up code to its log instead of sending email.
 * Read from `docker compose logs` (stderr included: Nest writes warnings there), newest line for this address.
 */
export async function verificationCode(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const log = execSync('docker compose logs api --no-color 2>&1', { cwd: '..' }).toString().replace(/\x1b\[[0-9;]*m/g, '');
    const code = [...log.matchAll(/Verification code for (\S+): (\d{6})/g)].filter((m) => m[1] === email).pop()?.[2];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No verification code for ${email} in the API log`);
}

/** A short random suffix, so a test can run twice against the same database. */
export const unique = () => Date.now().toString(36).slice(-5).toUpperCase();

import { test, expect } from '@playwright/test';
import { unique, verificationCode } from './helpers';

test('a new person signs up, confirms the emailed code and creates their workspace', async ({ page }) => {
  const id = unique().toLowerCase();
  const email = `e2e-${id}@example.com`;

  await page.goto('/en/register');
  await page.getByLabel('Full name').fill(`E2E Person ${id}`);
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('E2e-Passw0rd!');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/en\/verify-email/);
  await page.getByLabel('Digit 1').click();
  await page.keyboard.type(await verificationCode(email));
  await page.getByRole('button', { name: 'Verify email' }).click();
  await page.getByRole('link', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/en\/onboarding/);
  await page.getByLabel('Account name').fill(`E2E Account ${id}`);
  await page.getByLabel('Workspace name').fill(`E2E Workspace ${id}`);
  await page.getByRole('button', { name: 'Create account & workspace' }).click();
  await expect(page.getByText('Your workspace is ready')).toBeVisible();
});

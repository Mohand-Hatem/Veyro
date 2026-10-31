import { test, expect, type Page } from '@playwright/test';
import { signInAsDemo, WORKSPACE } from './helpers';

// Every screen an owner can reach, in both languages, at a desktop and a phone width: it must load without a browser error,
// without a failed API call, without sideways scrolling, and in the right reading direction.
const PAGES = [
  '/dashboard',
  `/w/${WORKSPACE}/projects`,
  `/w/${WORKSPACE}/projects/WEB`,
  `/w/${WORKSPACE}/my-tasks`,
  `/w/${WORKSPACE}/settings`,
  `/w/${WORKSPACE}/audit`,
  '/assistant',
  '/account/billing',
  '/account/audit',
  '/account/profile',
  '/help',
  '/help/contact',
];

async function check(page: Page, path: string, lang: 'en' | 'ar') {
  const problems: string[] = [];
  const onConsole = (m: { type(): string; text(): string }) => {
    // A failed request also logs "Failed to load resource"; those are caught below with their status.
    if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) problems.push(`console: ${m.text().slice(0, 160)}`);
  };
  const onPageError = (e: Error) => problems.push(`page error: ${e.message.slice(0, 160)}`);
  const onResponse = (r: { url(): string; status(): number }) => {
    if (r.url().includes('/api/v1/') && r.status() >= 400) problems.push(`api ${r.status()}: ${new URL(r.url()).pathname}`);
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('response', onResponse);
  await page.goto(`/${lang}${path}`, { waitUntil: 'networkidle' });
  await expect(page.locator('h1').first()).toBeVisible();
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    dir: document.documentElement.dir,
  }));
  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  page.off('response', onResponse);
  expect.soft(problems, `${lang}${path}`).toEqual([]);
  expect.soft(layout.overflow, `${lang}${path} scrolls sideways`).toBeLessThanOrEqual(0);
  expect.soft(layout.dir, `${lang}${path} reading direction`).toBe(lang === 'ar' ? 'rtl' : 'ltr');
}

for (const [label, size] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  test(`every screen loads cleanly in English and Arabic (${label})`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(size);
    await signInAsDemo(page, 'owner');

    // The task page needs a real task: open the first one from the board.
    await page.goto(`/en/w/${WORKSPACE}/projects/WEB`);
    const board = page.getByRole('region', { name: 'Task board' });
    await board.getByRole('button', { name: /^Task options: / }).first().click();
    await page.getByRole('menuitem', { name: 'Open' }).click();
    await expect(page).toHaveURL(/\/tasks\//);
    const taskPage = new URL(page.url()).pathname.replace(/^\/en/, '');

    for (const lang of ['en', 'ar'] as const) {
      for (const path of [...PAGES, taskPage]) await check(page, path, lang);
    }
  });
}

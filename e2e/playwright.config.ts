import { defineConfig, devices } from '@playwright/test';

// The stack is started outside Playwright (docker compose for the API and database, `next start` for the app), the same in CI
// and on a laptop, so this config only says where the app is and what to keep when a test fails.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // the journeys share one seeded workspace and one login rate limit
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

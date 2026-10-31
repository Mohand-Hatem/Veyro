import { test, expect } from '@playwright/test';
import { signInAsDemo, WORKSPACE } from './helpers';

// The server enforces every rule (backend tests prove that); this checks the interface tells a member the same story.
test('a member sees the board but not the controls reserved for admins', async ({ page }) => {
  await signInAsDemo(page, 'member');

  await page.goto(`/en/w/${WORKSPACE}/projects/WEB`);
  await expect(page.getByRole('region', { name: 'Task board' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add task' })).toHaveCount(0);

  await page.goto(`/en/w/${WORKSPACE}/settings`);
  await expect(page.getByText('Only workspace admins can manage members')).toBeVisible();
});

import { test, expect } from '@playwright/test';
import { signInAsDemo, WORKSPACE } from './helpers';

// Regression: leaving the title (or description) field without changing it put `undefined` over the task's title and the
// page crashed into "Something went wrong".
test('clicking into the title and away again leaves the task page working', async ({ page }) => {
  await signInAsDemo(page, 'owner');
  await page.goto(`/en/w/${WORKSPACE}/projects/WEB`);
  const board = page.getByRole('region', { name: 'Task board' });
  await board.getByRole('button', { name: /^Task options: / }).first().click();
  await page.getByRole('menuitem', { name: 'Open' }).click();
  await expect(page).toHaveURL(/\/tasks\//);

  const title = page.locator('#tp-title');
  const before = await title.inputValue();
  for (const field of ['#tp-title', '#tp-desc']) {
    await page.locator(field).click();
    await page.getByRole('heading', { level: 1 }).click(); // somewhere neutral: the field loses focus unchanged
  }

  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(title).toHaveValue(before);
});

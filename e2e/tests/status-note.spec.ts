import { test, expect } from '@playwright/test';
import { signInAsDemo, WORKSPACE } from './helpers';

test('a member moves their task only after saying what was done, and the team sees the note', async ({ page }) => {
  await signInAsDemo(page, 'member');
  await page.goto(`/en/w/${WORKSPACE}/projects/WEB`);
  const board = page.getByRole('region', { name: 'Task board' });
  await board.getByRole('button', { name: 'Task options: Design the new homepage' }).click();
  await page.getByRole('menuitem', { name: 'Open' }).click();
  await expect(page).toHaveURL(/\/tasks\//);

  // The brief says who is on the task.
  const people = page.getByRole('list', { name: 'People on this task' });
  await expect(people).toContainText('Created by');
  await expect(people).toContainText('Assigned to');

  // Picking a step saves nothing yet: the note comes first.
  const steps = page.getByRole('list', { name: 'Workflow steps' });
  await steps.getByRole('button', { name: 'In review' }).click();
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeDisabled();
  await expect(page.locator('#tp-pill')).toHaveText('In progress');

  const note = `Homepage hero and pricing block are done (${Date.now().toString(36)})`;
  await page.getByLabel('What did you do, and what is next?').fill(note);
  await save.click();

  await expect(page.locator('#tp-pill')).toHaveText('In review');
  await expect(page.locator('#tp-cl')).toContainText(note);
});

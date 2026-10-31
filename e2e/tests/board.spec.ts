import { test, expect } from '@playwright/test';
import { signInAsDemo, unique, WORKSPACE } from './helpers';

test('an owner creates a project, adds a task and moves it across the board', async ({ page }) => {
  const id = unique();
  const projectName = `E2E project ${id}`;
  const taskTitle = `E2E task ${id}`;

  await signInAsDemo(page, 'owner');
  await page.goto(`/en/w/${WORKSPACE}/projects`);
  await page.getByRole('link', { name: 'Create new project' }).click();
  await page.getByLabel('Project name').fill(projectName);
  await page.getByLabel('Project key').fill(`E${id.slice(0, 4)}`);
  await page.getByRole('button', { name: 'Create project' }).click();

  // The new project joins the list; open its (empty) board from there.
  await page.getByRole('link', { name: projectName }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/E${id.slice(0, 4)}$`));
  const board = page.getByRole('region', { name: 'Task board' });
  await expect(board).toBeVisible();

  await page.locator('#bd-add').click();
  await page.getByLabel('Title', { exact: true }).and(page.locator('#tk-name')).fill(taskTitle);
  await page.getByRole('button', { name: 'Create task' }).click();

  const todo = board.getByRole('region', { name: 'To do' });
  await expect(todo.getByText(taskTitle)).toBeVisible();

  // Move it with the card menu (the keyboard path; drag and drop does the same through the same request).
  await board.getByRole('button', { name: `Task options: ${taskTitle}` }).click();
  await page.getByRole('menuitem', { name: /Move to In progress/ }).click();
  await expect(board.getByRole('region', { name: 'In progress' }).getByText(taskTitle)).toBeVisible();
  await expect(todo.getByText(taskTitle)).toHaveCount(0);

  // It survives a reload: the move was saved, not just drawn.
  await page.reload();
  await expect(page.getByRole('region', { name: 'In progress' }).getByText(taskTitle)).toBeVisible();
});

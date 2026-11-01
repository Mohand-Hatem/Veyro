import { test, expect } from '@playwright/test';
import { signInAsDemo, unique, WORKSPACE } from './helpers';

// CS-16: typing "@" offers the project's people, the comment shows the name, and the person mentioned hears about it.
test('a comment that mentions a teammate shows their name and reaches their bell', async ({ page }) => {
  const title = 'Write the launch announcement'; // in WEB, where Layla, Omar and Mona are members
  const word = `ready-${unique()}`;
  await signInAsDemo(page, 'owner');
  await page.goto(`/en/w/${WORKSPACE}/projects/WEB`);
  await page.getByRole('button', { name: `Task options: ${title}` }).click();
  await page.getByRole('menuitem', { name: 'Open' }).click();
  await expect(page).toHaveURL(/\/tasks\//);

  const box = page.locator('#tp-cin');
  await box.click();
  await box.pressSequentially('Can @mo');
  const list = page.getByRole('listbox', { name: 'People to mention' });
  await expect(list.getByRole('option', { name: /Mona Adel/ })).toBeVisible();
  await expect(list.getByRole('option', { name: /Layla Hassan/ })).toHaveCount(0); // never yourself
  await box.press('Enter');
  await box.pressSequentially(`check this? ${word}`); // straight away: the caret must already sit after the name
  await expect(box).toHaveValue(`Can @Mona Adel check this? ${word}`);
  await page.locator('#tp-csend').click();

  const posted = page.locator('#tp-cl li').filter({ hasText: word });
  await expect(posted.locator('.mn-at')).toHaveText('@Mona Adel');

  await page.context().clearCookies();
  await signInAsDemo(page, 'member');
  await page.getByRole('button', { name: /^Notifications/ }).click();
  await expect(page.getByText(`Layla Hassan mentioned you on ${title}`).first()).toBeVisible();
});

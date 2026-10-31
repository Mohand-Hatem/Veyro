import { test, expect } from '@playwright/test';
import { signInAsDemo, sql, unique, WORKSPACE } from './helpers';

// The CI stack has no Cloudinary account, so the file row is written straight into the database; what is tested here is
// who sees what. Uploads against the real Cloudinary are checked on the live site.
test('a file on a task is shown to the people on it and only counted for everyone else', async ({ page }) => {
  const title = 'Write the launch announcement'; // created by Layla (owner), assigned to Omar (admin); Mona is a plain member
  const taskId = sql(`select id from tasks where title = '${title}' limit 1`);
  const id = `e2e${unique().toLowerCase()}`;
  sql(`insert into task_attachments (id, "taskId", "uploaderId", "publicId", "resourceType", format, "fileName", bytes) select '${id}', '${taskId}', "authorId", 'Veyro/tasks/${taskId}/${id}.pdf', 'raw', 'pdf', 'Launch brief.pdf', 48213 from tasks where id = '${taskId}'`);
  try {
    await signInAsDemo(page, 'member');
    await page.goto(`/en/w/${WORKSPACE}/projects/WEB`);
    await page.getByRole('button', { name: `Task options: ${title}` }).click();
    await page.getByRole('menuitem', { name: 'Open' }).click();
    await expect(page).toHaveURL(/\/tasks\//);
    await expect(page.locator('#tf-locked')).toContainText('1 file on this task');
    await expect(page.getByText('Launch brief.pdf')).toHaveCount(0);

    await page.context().clearCookies();
    await signInAsDemo(page, 'admin');
    await page.goto(`/en/w/${WORKSPACE}/projects/WEB/tasks/${taskId}`);
    const list = page.locator('#tf-list');
    await expect(list).toContainText('Launch brief.pdf');
    await expect(list).toContainText('47.1 KB');
  } finally {
    sql(`delete from task_attachments where id = '${id}'`);
  }
});

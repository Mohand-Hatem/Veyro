import { test, expect, type Page } from '@playwright/test';
import { signInAsDemo, WORKSPACE } from './helpers';

// On a short phone screen every dialog must be a full-width bottom sheet whose last field and footer can be reached, and a busy
// button must keep a round spinner without moving the footer. A tall test screen hid the scroll bug, so this one is 640px high.
// Reduced motion stops the slide-in, which otherwise sits on its first frame between commands in a headless browser.
test.use({ viewport: { width: 390, height: 640 }, reducedMotion: 'reduce' });

const DIALOGS: { name: string; path: string; open: (page: Page) => Promise<void> }[] = [
  { name: 'invite', path: `/w/${WORKSPACE}/settings`, open: (p) => p.getByRole('button', { name: 'Invite member' }).first().click() },
  { name: 'remove member', path: `/w/${WORKSPACE}/settings`, open: (p) => p.locator('button[aria-label^="Remove"]').first().click() },
  { name: 'add task', path: `/w/${WORKSPACE}/projects/WEB`, open: (p) => p.getByRole('button', { name: 'Add task' }).first().click() },
  { name: 'project members', path: `/w/${WORKSPACE}/projects/WEB`, open: (p) => p.getByRole('button', { name: /Project members/ }).first().click() },
  {
    name: 'create project',
    path: `/w/${WORKSPACE}/projects`,
    open: async (p) => {
      await p.getByRole('button', { name: 'Open navigation' }).click();
      await p.getByRole('button', { name: 'Create new project' }).first().click();
    },
  },
  { name: 'delete account', path: '/account/billing', open: (p) => p.getByRole('button', { name: 'Delete account…' }).click() },
];

test('dialogs are reachable bottom sheets on a short phone screen', async ({ page }) => {
  test.setTimeout(180_000);
  await signInAsDemo(page, 'owner');
  for (const d of DIALOGS) {
    await page.goto(`/en${d.path}`, { waitUntil: 'networkidle' });
    await d.open(page);
    const dialog = page.locator('dialog[open]').last();
    await expect(dialog, d.name).toBeVisible();
    const m = await dialog.evaluate((dlg) => {
      const r = dlg.getBoundingClientRect();
      // scroll the last field into view the way a thumb would, through whichever box (sheet or inner list) holds it
      const fields = [...dlg.querySelectorAll<HTMLElement>('input:not([type=hidden]), textarea, select')].filter((e) => e.offsetParent);
      fields.at(-1)?.scrollIntoView({ block: 'center' }); // 'end' would tuck it under the pinned footer, where no thumb leaves it
      // code can scroll an overflow:hidden box but a thumb cannot, so a scrolled hidden box means the field is out of reach
      let clipped = false;
      for (let el = fields.at(-1)?.parentElement; el && el !== dlg.parentElement; el = el.parentElement) {
        if (el.scrollTop > 0 && getComputedStyle(el).overflowY === 'hidden') clipped = true;
      }
      const foot = dlg.querySelector('.pm-foot')?.getBoundingClientRect();
      const last = fields.at(-1)?.getBoundingClientRect();
      const footer = () => [...dlg.querySelectorAll('.pm-foot .pm-btn')].map((b) => { const br = b.getBoundingClientRect(); return `${br.top}/${br.width}`; }).join(' ');
      const go = dlg.querySelector('.pm-go');
      let spin: { w: number; h: number } | null = null;
      let footerMoved = false;
      if (go?.querySelector('.pm-spin')) {
        const idle = footer();
        go.setAttribute('aria-busy', 'true');
        const s = go.querySelector('.pm-spin')!.getBoundingClientRect();
        spin = { w: s.width, h: s.height };
        footerMoved = footer() !== idle;
        go.removeAttribute('aria-busy');
      }
      return {
        left: r.left, right: document.documentElement.clientWidth - r.right, bottom: innerHeight - r.bottom,
        lastFieldHidden: clipped || !!(last && foot && last.bottom > foot.top + 1), footHidden: !!(foot && foot.bottom > innerHeight + 1), spin, footerMoved,
      };
    });
    expect.soft(Math.abs(m.left), `${d.name}: starts at the left edge`).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(m.right), `${d.name}: reaches the right edge`).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(m.bottom), `${d.name}: sits on the bottom edge`).toBeLessThanOrEqual(1);
    expect.soft(m.lastFieldHidden, `${d.name}: last field scrolls into view above the footer`).toBe(false);
    expect.soft(m.footHidden, `${d.name}: footer stays on screen`).toBe(false);
    if (m.spin) expect.soft(Math.abs(m.spin.w - m.spin.h), `${d.name}: spinner stays round`).toBeLessThanOrEqual(0.5);
    expect.soft(m.footerMoved, `${d.name}: footer does not move when the button turns busy`).toBe(false);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
});

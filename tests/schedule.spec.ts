import { test, expect, type Page } from '@playwright/test';

const visibleRows = (page: Page) => page.locator('[data-event]:visible');

test.describe('schedule', () => {
  test('renders the weekend with day tabs and events', async ({ page }) => {
    await page.goto('/?day=all');
    await expect(page).toHaveTitle(/Spooky Bear 2026/);
    await expect(page.getByRole('tab', { name: /Sat/ })).toBeVisible();
    expect(await visibleRows(page).count()).toBeGreaterThan(40);
    await expect(page.getByRole('heading', { name: /Saturday/ })).toBeVisible();
  });

  test('day tabs filter the list and sync to the URL', async ({ page }) => {
    await page.goto('/?day=all');
    await page.getByRole('tab', { name: /Fri/ }).click();
    await expect(page).toHaveURL(/day=fri/);
    await expect(page.locator('[data-day-group="fri"]')).toBeVisible();
    await expect(page.locator('[data-day-group="sat"]')).toBeHidden();
    const friCount = await visibleRows(page).count();
    expect(friCount).toBeGreaterThan(5);
    for (const row of await visibleRows(page).all()) await expect(row).toHaveAttribute('data-day', 'fri');
  });

  test('location filter supports multiple venues', async ({ page }) => {
    await page.goto('/?day=sat');
    const before = await visibleRows(page).count();
    await page.getByRole('button', { name: 'Location' }).click();
    const panel = page.locator('[data-menu="venue"] [data-menu-panel]');
    await expect(panel).toBeVisible();
    // Toggle via keyboard: the checkbox is visually hidden behind a styled box, and this
    // doubles as the accessibility path (focus + Space).
    for (const name of [/Crown & Anchor/, /Red Room/]) {
      const box = panel.getByRole('checkbox', { name });
      await box.focus();
      await page.keyboard.press('Space');
      await expect(box).toBeChecked();
    }
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    const after = await visibleRows(page).count();
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
    for (const row of await visibleRows(page).all()) {
      expect(['crown-anchor', 'red-room']).toContain(await row.getAttribute('data-venue'));
    }
    await expect(page.locator('[data-menu="venue"] [data-menu-count]')).toHaveText('2');
    await expect(page).toHaveURL(/venue=crown-anchor%2Cred-room|venue=crown-anchor,red-room/);
  });

  test('time window filter keeps only overlapping events', async ({ page }) => {
    await page.goto('/?day=sat&from=21:00&to=02:00');
    const rows = await visibleRows(page).all();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const start = await row.getAttribute('data-start');
      expect(start).toBeTruthy();
      const [h] = start!.split(':').map(Number);
      const mins = (h < 5 ? h + 24 : h) * 60;
      // Starts before 2am (next day) and, given a default 2h length, ends after 9pm.
      expect(mins).toBeLessThan(26 * 60);
    }
    await expect(page.getByRole('button', { name: /9pm to 2am/ })).toBeVisible();
  });

  test('search finds events across every day', async ({ page }) => {
    await page.goto('/?day=thu');
    await page.getByRole('button', { name: 'Search events' }).click();
    const input = page.getByRole('searchbox', { name: 'Search events' });
    await input.fill('bingo');
    await expect(page.locator('[data-event][data-slug="drag-bingo-for-a-cause"]')).toBeVisible();
    await expect(page.getByText('Searching across every day.')).toBeVisible();
    expect(await visibleRows(page).count()).toBeLessThan(6);
    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(await visibleRows(page).count()).toBeGreaterThan(5);
  });

  test('clear all resets filters', async ({ page }) => {
    await page.goto('/?day=sat&venue=boatslip&price=free');
    const filtered = await visibleRows(page).count();
    await page.getByRole('button', { name: 'Clear all' }).click();
    expect(await visibleRows(page).count()).toBeGreaterThan(filtered);
    await expect(page).not.toHaveURL(/venue=/);
  });
});

test.describe('event dialog', () => {
  test('opens from a row, updates the URL and title, closes back to the list', async ({ page }) => {
    await page.goto('/?day=sat');
    const row = page.locator('[data-event][data-slug="drag-bingo-for-a-cause"] [data-open]');
    await row.click();
    const dialog = page.locator('#event-dialog');
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/event\/drag-bingo-for-a-cause$/);
    await expect(page).toHaveTitle(/Drag Bingo for a Cause/);
    await expect(dialog.getByRole('heading', { name: 'Drag Bingo for a Cause' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Get tickets' })).toBeVisible();
    await expect(dialog.getByText('Notice something wrong?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/\?day=sat/);
  });

  test('a shared event URL opens straight to that event on its day', async ({ page }) => {
    await page.goto('/event/fat-slut-with-meatball');
    const dialog = page.locator('#event-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /FAT SLUT/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Thu/ })).toHaveAttribute('aria-selected', 'true');
    // Structured data for search engines and assistants.
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(JSON.parse(ld!)['@type']).toBe('Event');
  });

  test('unknown event slug shows the 404 page', async ({ page }) => {
    const res = await page.goto('/event/does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/wandered off into the fog/)).toBeVisible();
  });
});

test.describe('my den (favourites)', () => {
  test('saving an event persists across reloads and shows in the den', async ({ page }) => {
    await page.goto('/?day=thu');
    const paw = page.locator('[data-event][data-slug="early-bear-meet-up"] [data-paw]');
    await paw.click();
    await expect(paw).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-den-count]')).toHaveText('1');
    await expect(page.locator('#den [data-den-clone][data-slug="early-bear-meet-up"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-event][data-slug="early-bear-meet-up"] [data-paw]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#den')).toBeVisible();
    // The dialog shows the saved badge too.
    await page.locator('[data-event][data-slug="early-bear-meet-up"] [data-open]').click();
    await expect(page.locator('#event-dialog [data-saved-badge]')).toBeVisible();
  });
});

test.describe('other pages', () => {
  test('about page has the bio and feedback buttons', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'About this site' })).toBeVisible();
    await expect(page.getByText(/Hiring frontend engineers/)).toBeVisible();
    await page.getByRole('button', { name: 'Suggest an event' }).click();
    const fb = page.locator('#feedback-dialog');
    await expect(fb).toBeVisible();
    await expect(fb.getByRole('radio', { name: 'Suggest an event' })).toBeChecked();
  });

  test('privacy page exists and is linked from the footer', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
  });

  test('machine-readable feeds respond', async ({ request }) => {
    const json = await request.get('/events.json');
    expect(json.ok()).toBeTruthy();
    const body = await json.json();
    expect(body.events.length).toBeGreaterThan(40);
    expect(body.events[0]).toHaveProperty('sources');
    const ics = await request.get('/events.ics');
    expect(ics.ok()).toBeTruthy();
    expect(await ics.text()).toContain('BEGIN:VCALENDAR');
    const llms = await request.get('/llms.txt');
    expect(llms.ok()).toBeTruthy();
  });
});

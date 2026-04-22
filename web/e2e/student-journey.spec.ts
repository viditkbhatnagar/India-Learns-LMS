import { test, expect, type Page } from '@playwright/test';

/**
 * Student happy-path E2E. Mirrors the smoke-test items #4 (login), #6 (course
 * view), #9 (fees visible), and #11 (raise a ticket). The full multi-actor
 * smoke (admin invite → student accept → faculty grade → finance record → cert
 * issue) is covered by the operator's manual `docs/smoke/m9-launch.md`
 * checklist; this spec keeps the always-on verification in CI focused on the
 * single-actor browser path.
 */

const STUDENT_EMAIL = 'student-seed-1@luc.local';
const STUDENT_PASSWORD = 'Student#12345';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(STUDENT_EMAIL);
  await page.getByLabel(/password/i).fill(STUDENT_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/student\/dashboard/, { timeout: 15_000 });
}

test.describe('Student happy path', () => {
  test('dashboard tiles render with seeded data', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/welcome back/i);
    // Six tiles: next class, outstanding, tickets, notifications, feedback, certs
    await expect(page.getByText(/next class/i)).toBeVisible();
    await expect(page.getByText(/outstanding fees/i)).toBeVisible();
    await expect(page.getByText(/open tickets/i)).toBeVisible();
    await expect(page.getByText(/certificates/i)).toBeVisible();
  });

  test('navigates to courses, fees, tickets', async ({ page }) => {
    await login(page);
    // Sidebar nav (desktop)
    await page.getByRole('link', { name: 'Courses', exact: true }).click();
    await page.waitForURL(/\/student\/courses/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('link', { name: 'Fees', exact: true }).click();
    await page.waitForURL(/\/student\/fees/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('link', { name: 'Tickets', exact: true }).click();
    await page.waitForURL(/\/student\/tickets/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('opens the new-ticket form', async ({ page }) => {
    await login(page);
    await page.goto('/student/tickets/new');
    await expect(page.getByLabel(/subject/i)).toBeVisible();
    await expect(page.getByLabel(/description/i)).toBeVisible();
  });

  test('logs out and returns to login', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL(/\/login/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });
});

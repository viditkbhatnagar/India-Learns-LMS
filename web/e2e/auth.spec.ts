import { test, expect } from '@playwright/test';

/**
 * Auth + role-routing smoke. Assumes the API is running with the dev seed
 * (`npm run seed -w api`) so the three seeded users exist:
 *   - student-seed-1@luc.local / Student#12345
 *   - faculty-seed-1@luc.local / Faculty#12345
 *   - finance-seed-1@luc.local / Finance#12345
 *
 * If a role login fails, the test is marked failed (operator should run the
 * seed before running e2e). Tests are not skipped silently.
 */

const ROLES = [
  {
    role: 'student',
    email: 'student-seed-1@luc.local',
    password: 'Student#12345',
    landing: /\/student\/dashboard/,
    expectHeading: /Welcome back/i,
  },
  {
    role: 'faculty',
    email: 'faculty-seed-1@luc.local',
    password: 'Faculty#12345',
    landing: /\/faculty\/dashboard/,
    expectHeading: /Hello/i,
  },
  {
    role: 'finance',
    email: 'finance-seed-1@luc.local',
    password: 'Finance#12345',
    landing: /\/finance\/dashboard/,
    expectHeading: /Finance/i,
  },
] as const;

test.describe('Auth + role routing', () => {
  test('login screen renders with brand and form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('rejects bad credentials with an error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('nobody@example.com');
    await page.getByLabel(/password/i).fill('wrong-password');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page.getByText(/invalid|incorrect|failed/i)).toBeVisible({ timeout: 8_000 });
  });

  for (const r of ROLES) {
    test(`${r.role} can log in and lands on the right dashboard`, async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(r.email);
      await page.getByLabel(/password/i).fill(r.password);
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(r.landing, { timeout: 15_000 });
      await expect(page.getByRole('heading', { level: 1 })).toContainText(r.expectHeading);
      // Top-bar logout button is present
      await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
    });
  }
});

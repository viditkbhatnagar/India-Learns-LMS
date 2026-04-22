import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

/**
 * Accessibility sweep — runs axe-core against every authenticated route per
 * role and asserts zero `serious` or `critical` violations. Tags / WCAG 2.1
 * AA per UI/UX Spec §10. Notices (best-practice) are reported but not failed.
 */

interface Acct {
  email: string;
  password: string;
  routes: string[];
}

const ACCOUNTS: Record<string, Acct> = {
  student: {
    email: 'student-seed-1@luc.local',
    password: 'Student#12345',
    routes: [
      '/student/dashboard',
      '/student/courses',
      '/student/timetable',
      '/student/fees',
      '/student/tickets',
      '/student/feedback',
      '/student/certificates',
    ],
  },
  faculty: {
    email: 'faculty-seed-1@luc.local',
    password: 'Faculty#12345',
    routes: [
      '/faculty/dashboard',
      '/faculty/courses',
      '/faculty/grading',
      '/faculty/feedback',
      '/faculty/timetable',
    ],
  },
  finance: {
    email: 'finance-seed-1@luc.local',
    password: 'Finance#12345',
    routes: [
      '/finance/dashboard',
      '/finance/students',
      '/finance/payments',
      '/finance/payments/new',
      '/finance/reports',
    ],
  },
};

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/(student|faculty|finance|admin)\/dashboard/, { timeout: 15_000 });
}

for (const [role, acct] of Object.entries(ACCOUNTS)) {
  test.describe(`a11y — ${role}`, () => {
    for (const route of acct.routes) {
      test(`${route} has no serious/critical axe violations`, async ({ page }) => {
        await login(page, acct.email, acct.password);
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        const blocking = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        if (blocking.length) {
          console.error(JSON.stringify(blocking, null, 2));
        }
        expect(blocking).toEqual([]);
      });
    }
  });
}

test('login page is accessible', async ({ page }) => {
  await page.goto('/login');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(blocking).toEqual([]);
});

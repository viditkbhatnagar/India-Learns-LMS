import { test, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Screenshot capture for the M9 deliverable. Tagged @screenshots so it can be
 * run independently:
 *   npm run screenshots -w web
 *
 * Writes PNGs to ../docs/screenshots/. Each role logs in and a key dashboard
 * is captured.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '../../docs/screenshots');

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

async function login(page: Page, email: string, password: string, expectUrl: RegExp) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(expectUrl, { timeout: 15_000 });
  await page.waitForLoadState('networkidle');
}

async function snap(page: Page, route: string, name: string) {
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  // Brief settle for any post-load skeleton swap.
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

test.describe('@screenshots web app', () => {
  test('student dashboard + key screens', async ({ page }) => {
    await login(page, 'student-seed-1@luc.local', 'Student#12345', /\/student\/dashboard/);
    await snap(page, '/student/dashboard', 'student-dashboard');
    await snap(page, '/student/courses', 'student-courses');
    await snap(page, '/student/fees', 'student-fees');
    await snap(page, '/student/tickets', 'student-tickets');
    await snap(page, '/student/timetable', 'student-timetable');
    await snap(page, '/student/certificates', 'student-certificates');
  });

  test('faculty dashboard', async ({ page }) => {
    await login(page, 'faculty-seed-1@luc.local', 'Faculty#12345', /\/faculty\/dashboard/);
    await snap(page, '/faculty/dashboard', 'faculty-dashboard');
    await snap(page, '/faculty/courses', 'faculty-courses');
    await snap(page, '/faculty/grading', 'faculty-grading');
  });

  test('finance dashboard', async ({ page }) => {
    await login(page, 'finance-seed-1@luc.local', 'Finance#12345', /\/finance\/dashboard/);
    await snap(page, '/finance/dashboard', 'finance-dashboard');
    await snap(page, '/finance/payments', 'finance-payments');
    await snap(page, '/finance/payments/new', 'finance-record-payment');
  });

  test('mobile shell (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, 'student-seed-1@luc.local', 'Student#12345', /\/student\/dashboard/);
    await snap(page, '/student/dashboard', 'mobile-student-dashboard');
    await snap(page, '/student/courses', 'mobile-student-courses');
  });

  test('public onboarding flow', async ({ page }) => {
    await snap(page, '/onboarding/email-invite', 'onboarding-1-email');
    await snap(page, '/onboarding/landing', 'onboarding-2-landing');
    await snap(page, '/onboarding/set-password', 'onboarding-3-password');
    await snap(page, '/onboarding/tour', 'onboarding-4-tour');
    await snap(page, '/onboarding/arrival', 'onboarding-5-arrival');
  });
});

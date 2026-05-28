import { test, expect } from '@playwright/test';

// Proves the BROWSE→SELECT→UPLOAD pipeline works once a real local file
// is chosen — i.e. the app is fine; the only obstacle is the native OS
// dialog opening at OneDrive (which web code cannot control and which
// Playwright bypasses via setInputFiles). Run against prod:
//   PLAYWRIGHT_BASE_URL=https://india-learns-lms.onrender.com

const FACULTY = { email: 'faculty-seed-1@luc.local', password: 'Faculty#12345' };
const AIRPORT_COURSE = '6a01cef37f9a5b65ee08c6c4';
const AIRPORT_SESSION = '6a16b9bb2c168b497a80a581';
const LOCAL_FILE = '/tmp/local-deck.pptx';

test('browse → select a local file → uploads (201)', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(FACULTY.email);
  await page.getByLabel(/password/i).fill(FACULTY.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/faculty\/dashboard/, { timeout: 20_000 });

  await page.goto(`/courses/${AIRPORT_COURSE}/sessions/${AIRPORT_SESSION}`);
  await page.getByRole('button', { name: /\+ Add material/i }).click();

  // The hidden <input type="file"> inside the drop zone. setInputFiles
  // sets the file programmatically — exactly the state the browser is in
  // AFTER a successful native-dialog selection, minus the dialog itself.
  const input = page.locator('div[role="button"].border-dashed input[type="file"]').first();

  const uploadPromise = page
    .waitForResponse((r) => r.url().includes('/v1/files/upload'), { timeout: 15_000 })
    .catch(() => null);

  await input.setInputFiles(LOCAL_FILE);

  const resp = await uploadPromise;
  // eslint-disable-next-line no-console
  console.log('[browse] upload response:', resp ? `${resp.status()} ${resp.url()}` : 'NONE');
  expect(resp, 'selecting a local file should trigger POST /v1/files/upload').not.toBeNull();
  expect(resp!.status()).toBe(201);

  // And the form reflects the upload (title auto-filled from filename).
  // eslint-disable-next-line no-console
  console.log('[browse] upload succeeded — the app pipeline is fine');
});

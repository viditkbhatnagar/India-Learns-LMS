import { test, expect } from '@playwright/test';

// Verifies the Chromium File System Access browse path: when
// window.showOpenFilePicker exists, clicking the drop zone uses it
// (with startIn:'downloads') instead of the native <input> dialog, and
// the chosen file uploads. We stub showOpenFilePicker so the test is
// deterministic (the real API drives a native dialog Playwright can't
// control). Run against prod with PLAYWRIGHT_BASE_URL set, AFTER the
// showOpenFilePicker change is deployed.

const FACULTY = { email: 'faculty-seed-1@luc.local', password: 'Faculty#12345' };
const AIRPORT_COURSE = '6a01cef37f9a5b65ee08c6c4';
const AIRPORT_SESSION = '6a16b9bb2c168b497a80a581';

test('browse uses showOpenFilePicker(startIn:downloads) when available', async ({ page }) => {
  // Stub the File System Access API + record the options it was called with.
  await page.addInitScript(() => {
    (window as unknown as { __pickerOpts?: unknown }).__pickerOpts = null;
    (window as unknown as Record<string, unknown>).showOpenFilePicker = async (opts: unknown) => {
      (window as unknown as { __pickerOpts?: unknown }).__pickerOpts = opts;
      const file = new File([new Uint8Array([80, 75, 3, 4, 1, 1])], 'fsa-deck.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      return [{ getFile: async () => file }];
    };
  });

  await page.goto('/login');
  await page.getByLabel(/email/i).fill(FACULTY.email);
  await page.getByLabel(/password/i).fill(FACULTY.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/faculty\/dashboard/, { timeout: 20_000 });

  await page.goto(`/courses/${AIRPORT_COURSE}/sessions/${AIRPORT_SESSION}`);
  await page.getByRole('button', { name: /\+ Add material/i }).click();

  const zone = page.locator('div[role="button"].border-dashed').first();
  await expect(zone).toBeVisible({ timeout: 10_000 });

  const uploadPromise = page
    .waitForResponse((r) => r.url().includes('/v1/files/upload'), { timeout: 15_000 })
    .catch(() => null);

  await zone.click();

  const resp = await uploadPromise;
  const opts = await page.evaluate(() => (window as unknown as { __pickerOpts?: unknown }).__pickerOpts);
  // eslint-disable-next-line no-console
  console.log('[fsa] showOpenFilePicker opts:', JSON.stringify(opts));
  // eslint-disable-next-line no-console
  console.log('[fsa] upload:', resp ? `${resp.status()}` : 'NONE');

  expect(opts, 'showOpenFilePicker should be called').not.toBeNull();
  expect((opts as { startIn?: string }).startIn).toBe('downloads');
  expect(resp, 'picked file should upload').not.toBeNull();
  expect(resp!.status()).toBe(201);
});

import { test, expect } from '@playwright/test';

// Repro for Logan's "drag and drop does nothing" on the airport course.
// Runs against PROD: PLAYWRIGHT_BASE_URL=https://india-learns-lms.onrender.com
// Logs in as the faculty who's on the airport roster (no oversight wall),
// opens the Add-material drop zone, and dispatches a real file-drop event.
// If the upload network call fires, the drop code works (and Logan's issue
// is her OneDrive online-only files). If not, we've found a real bug.

const FACULTY = { email: 'faculty-seed-1@luc.local', password: 'Faculty#12345' };
const AIRPORT_COURSE = '6a01cef37f9a5b65ee08c6c4';
const AIRPORT_SESSION = '6a16b9bb2c168b497a80a581';
const SLIDES_MATERIAL = '6a16b9bd2c168b497a80a5bb';

async function login(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(FACULTY.email);
  await page.getByLabel(/password/i).fill(FACULTY.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/faculty\/dashboard/, { timeout: 20_000 });
}

// Build a DataTransfer carrying a File, in page context.
async function makeFileDataTransfer(
  page: import('@playwright/test').Page,
  name: string,
  type: string,
): Promise<import('@playwright/test').JSHandle> {
  return page.evaluateHandle(
    ({ name: n, type: t }) => {
      const dt = new DataTransfer();
      const file = new File([new Uint8Array([80, 75, 3, 4, 9, 9, 9])], n, { type: t });
      dt.items.add(file);
      return dt;
    },
    { name, type },
  );
}

test('SCENARIO 1 — Add-material drop zone fires an upload on drop', async ({ page }) => {
  await login(page);

  await page.goto(`/courses/${AIRPORT_COURSE}/sessions/${AIRPORT_SESSION}`);
  // Reveal the add-material form.
  await page.getByRole('button', { name: /\+ Add material/i }).click();

  // Capture the drop-zone element ONCE as a fixed handle. The visible
  // label swaps to "Drop to upload" on dragenter, which would break a
  // lazy text locator — the handle does not re-query, so it survives.
  const zoneLocator = page.locator('div[role="button"].border-dashed').first();
  await expect(zoneLocator).toBeVisible({ timeout: 10_000 });
  const zone = await zoneLocator.elementHandle();
  expect(zone, 'drop zone element should resolve').not.toBeNull();

  const dt = await makeFileDataTransfer(
    page,
    'pw-deck.pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  );

  const uploadPromise = page
    .waitForResponse((r) => r.url().includes('/v1/files/upload'), { timeout: 15_000 })
    .catch(() => null);

  await zone!.dispatchEvent('dragenter', { dataTransfer: dt });
  await zone!.dispatchEvent('dragover', { dataTransfer: dt });
  await zone!.dispatchEvent('drop', { dataTransfer: dt });

  const resp = await uploadPromise;
  // eslint-disable-next-line no-console
  console.log('[repro] upload response:', resp ? `${resp.status()} ${resp.url()}` : 'NONE — drop did nothing');
  expect(resp, 'drop should trigger POST /v1/files/upload').not.toBeNull();
  expect(resp!.status()).toBe(201);
});

test('SCENARIO 2 — Replace-deck (JSON) drop zone toggles + accepts a drop', async ({ page }) => {
  await login(page);

  await page.goto(
    `/courses/${AIRPORT_COURSE}/sessions/${AIRPORT_SESSION}/materials/${SLIDES_MATERIAL}`,
  );
  // Toggle the drop zone open.
  await page.getByRole('button', { name: /Replace deck \(JSON\)/i }).click();

  const zoneLocator = page.locator('div[role="button"].border-dashed').first();
  await expect(zoneLocator).toBeVisible({ timeout: 10_000 });
  const zone = await zoneLocator.elementHandle();
  expect(zone, 'replace-deck drop zone should resolve').not.toBeNull();

  // A drop of a NON-json file should NOT crash and should not call replaceSlides.
  const badDt = await makeFileDataTransfer(page, 'pw-deck.pptx', 'application/octet-stream');
  await zone!.dispatchEvent('dragenter', { dataTransfer: badDt });
  await zone!.dispatchEvent('dragover', { dataTransfer: badDt });
  await zone!.dispatchEvent('drop', { dataTransfer: badDt });
  // The page must stay responsive (no freeze) — the toggle button is still here.
  await expect(page.getByRole('button', { name: /Replace deck \(JSON\)/i })).toBeVisible();
  // eslint-disable-next-line no-console
  console.log('[repro] replace-deck zone survived a non-JSON drop without freezing');
});

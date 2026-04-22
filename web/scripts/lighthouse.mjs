#!/usr/bin/env node
/**
 * Lighthouse runner for the M9 deliverable. Boots a headless Chrome via
 * chrome-launcher (bundled with lighthouse), runs Lighthouse against the
 * student dashboard, and prints the four scores. Exits non-zero if any
 * category < 90 (the M9 gate).
 *
 * Usage:
 *   npm run lighthouse -w web                # default URL: http://localhost:5173/student/dashboard
 *   LIGHTHOUSE_URL=https://staging.example.com/ npm run lighthouse -w web
 *
 * Pre-req: a server is already running at the URL. For local runs:
 *   npm run dev (two terminals: api on :4000, web on :5173)
 *   then log in once in a browser to seed cookies (Lighthouse runs anonymous,
 *   so for the student dashboard target either run against a public route
 *   like '/login' or pre-export the cookie via PLAYWRIGHT_STORAGE_STATE).
 */

import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const URL = process.env.LIGHTHOUSE_URL || 'http://localhost:5173/login';
const THRESHOLD = Number(process.env.LIGHTHOUSE_THRESHOLD || 90);

const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
try {
  const result = await lighthouse(URL, {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  });
  if (!result) throw new Error('Lighthouse returned no result');
  const cats = result.lhr.categories;
  const rows = ['performance', 'accessibility', 'best-practices', 'seo'].map((k) => {
    const score = Math.round((cats[k]?.score ?? 0) * 100);
    return { category: k, score };
  });
  console.info(`\nLighthouse — ${URL}\n${'-'.repeat(60)}`);
  for (const r of rows) {
    const ok = r.score >= THRESHOLD ? '✓' : '✗';
    console.info(`  ${ok}  ${r.category.padEnd(15)} ${r.score}`);
  }
  const failures = rows.filter((r) => r.score < THRESHOLD);
  if (failures.length) {
    console.error(
      `\n${failures.length} categor${failures.length === 1 ? 'y' : 'ies'} below ${THRESHOLD}:`,
      failures.map((f) => `${f.category}=${f.score}`).join(', '),
    );
    process.exit(1);
  }
  console.info(`\nAll categories ≥ ${THRESHOLD}.`);
  process.exit(0);
} finally {
  await chrome.kill();
}

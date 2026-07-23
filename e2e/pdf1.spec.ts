import { test } from '@playwright/test';
test('regen pdf via preview', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5175/surgery/record/case-or05', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.location.pathname.replace(/\/+$/,'').endsWith('/login') || Boolean(document.querySelector('.anesthesia-record-workstation')), undefined, { timeout: 15000 }).catch(()=>undefined);
  if (page.url().includes('/login')) { await page.getByRole('button', { name: '登录', exact: true }).click(); }
  await page.waitForSelector('.live-record-card', { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: '打印' }).click();
  await page.waitForSelector('.print-preview-page', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: '/tmp/kilo/record-print-A4.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
});

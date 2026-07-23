import { test } from '@playwright/test';
test('diag url', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5175/surgery/handover/NOT-EXIST-OP-XYZ', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  console.log('URL_FINAL=', page.url());
  console.log('CASEERROR=', await page.locator('.arco-alert, .section-card').first().textContent().catch(()=> 'none'));
});

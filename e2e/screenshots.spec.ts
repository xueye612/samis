import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import { corePages, openImplementedPage } from './helpers/pages';

const screenshotDir = path.resolve('test-results/screenshots');

test.describe('核心页面截图留档', () => {
  test.beforeAll(() => {
    fs.mkdirSync(screenshotDir, { recursive: true });
  });

  for (const target of corePages) {
    test(`${target.name} 生成全页面截图`, async ({ page }) => {
      await openImplementedPage(page, target);
      await page.screenshot({
        path: path.join(screenshotDir, target.screenshot),
        fullPage: true,
      });
    });
  }
});

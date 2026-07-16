import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  configPages,
  collectLayout,
  summarizeViolations,
  hasViolations,
  flattenViolations,
  layoutViewports,
  seedConfigSession,
  installConfigDataMock,
} from './helpers/layoutAssertions';

const evidenceDir = path.resolve('test-results/config-layout');

test.describe('配置页面响应式布局门禁', () => {
  test.beforeAll(() => {
    fs.mkdirSync(evidenceDir, { recursive: true });
  });

  for (const target of configPages) {
    for (const viewport of layoutViewports) {
      test(`${target.name} 在 ${viewport.width}×${viewport.height} 下布局合规`, async ({ page }) => {
        await seedConfigSession(page);
        await installConfigDataMock(page);
        await page.setViewportSize(viewport);
        await page.goto(target.path, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('load');
        await expect(page.locator('.app-content')).toBeVisible();
        // 等待表格数据渲染
        await expect(page.locator('.module-hero__title, .arco-table').first()).toBeVisible();
        await page.waitForTimeout(500);

        const report = await collectLayout(page);
        const violations = summarizeViolations(report);

        await test.info().attach(`${target.name}-${viewport.width}-report`, {
          body: JSON.stringify({ report, violations: flattenViolations(violations) }, null, 2),
          contentType: 'application/json',
        });

        if (hasViolations(violations)) {
          await page.screenshot({
            path: path.join(evidenceDir, `${target.path.replace(/\//g, '_')}-${viewport.width}x${viewport.height}.png`),
            fullPage: true,
          });
        }

        expect(
          flattenViolations(violations),
          `${target.name} 在 ${viewport.width} 视口存在布局违规`,
        ).toEqual([]);
      });
    }
  }
});

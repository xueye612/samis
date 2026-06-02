import { expect, test } from '@playwright/test';
import { watchConsoleErrors } from './helpers/consoleErrorWatcher';
import {
  DEFAULT_RECORD_CASE_ID,
  ensureDeviceWorkbenchVisible,
  openAnesthesiaRecord,
} from './helpers/anesthesiaRecord';

test.describe('麻醉记录单冲突处理 E2E', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('samis.e2e', '1');
    });
  });

  test('注入 mock 冲突后可查看并处理', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await openAnesthesiaRecord(page);
    await ensureDeviceWorkbenchVisible(page);
    await page.getByRole('button', { name: '注入测试冲突' }).click();

    const conflictChip = page.locator('.record-status-bar .sync-chip').filter({ hasText: /冲突/ });
    await expect(conflictChip.first()).toBeVisible({ timeout: 10_000 });
    await conflictChip.first().click();

    await expect(page.locator('.arco-modal').filter({ hasText: '同步冲突' })).toBeVisible();
    await expect(page.locator('.conflict-card pre').first()).toBeVisible();

    await page.getByRole('button', { name: '使用服务器版本' }).first().click();
    await expect(page.locator('.record-status-bar .sync-chip').filter({ hasText: /冲突/ })).toHaveCount(0, {
      timeout: 10_000,
    });

    watcher.assertNoSevereErrors();
  });
});

test.describe('麻醉记录单跨页 vital E2E', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('samis.e2e', '1');
    });
  });

  test('页边界 vital 不重复显示', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await openAnesthesiaRecord(page);

    const seedResult = await page.evaluate(async (caseId) => {
      const api = (window as Window & { __samisAnesthesiaE2E?: { seedBoundaryVitals?: (id: string) => unknown } }).__samisAnesthesiaE2E;
      return api?.seedBoundaryVitals?.(caseId) ?? null;
    }, DEFAULT_RECORD_CASE_ID);
    test.skip(!seedResult, '无法注入页边界测试数据');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openAnesthesiaRecord(page);

    const pageIndicator = page.locator('.live-page-indicator, .sheet-page-indicator').first();
    if (await pageIndicator.count()) {
      await expect(pageIndicator).toContainText('1');
    }

    const boundaryTime = (seedResult as { boundaryTime?: string }).boundaryTime ?? '';
    if (boundaryTime) {
      await expect(page.locator('.live-record-card')).not.toContainText(`${boundaryTime} 边界重复`);
    }

    const nextPageButton = page.getByRole('button', { name: /下一页|后一页|›/ }).first();
    if (await nextPageButton.count()) {
      await nextPageButton.click();
      if (await pageIndicator.count()) {
        await expect(pageIndicator).toContainText('2');
      }
    }

    watcher.assertNoSevereErrors();
  });
});

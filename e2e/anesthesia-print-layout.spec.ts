import { expect, test } from '@playwright/test';
import { watchConsoleErrors } from './helpers/consoleErrorWatcher';
import { getRecordSheetBox, openAnesthesiaRecord, startMonitorMockFromWorkbench, stopMonitorMockFromWorkbench } from './helpers/anesthesiaRecord';

test.describe('麻醉记录单打印与状态栏', () => {
  test.setTimeout(90_000);

  test('状态栏存在且不挤压打印主体，打印媒体下隐藏', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await openAnesthesiaRecord(page);

    const beforeBox = await getRecordSheetBox(page);
    expect(beforeBox?.width).toBeGreaterThan(200);

    await startMonitorMockFromWorkbench(page);
    await expect(page.locator('.record-status-bar')).toBeVisible();
    await expect(page.locator('.record-status-bar .sync-chip').filter({ hasText: /网络在线|网络离线|最近同步|待上传/ }).first()).toBeVisible({
      timeout: 15_000,
    });

    const duringBox = await getRecordSheetBox(page);
    if (beforeBox && duringBox) {
      expect(Math.abs(duringBox.width - beforeBox.width)).toBeLessThan(24);
      expect(Math.abs(duringBox.height - beforeBox.height)).toBeLessThan(48);
    }

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.record-status-bar')).toBeHidden();

    await page.emulateMedia({ media: 'screen' });
    await stopMonitorMockFromWorkbench(page);
    watcher.assertNoSevereErrors();
  });

  test('打印预览隐藏状态栏、设备面板与编辑痕迹', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('samis.e2e', '1');
    });
    await openAnesthesiaRecord(page);
    await startMonitorMockFromWorkbench(page);

    await page.locator('.top-primary-actions').getByRole('button', { name: '更多' }).click();
    await page.getByText('打印预览', { exact: true }).click();

    await expect(page.locator('.record-status-bar')).toBeHidden();
    await expect(page.locator('.device-workbench')).toBeHidden();
    await expect(page.locator('.print-preview-shell .paper-picker-trigger')).toHaveCount(0);
    await expect(page.locator('.print-preview-shell .paper-picker-action')).toHaveCount(0);
    await expect(page.locator('.print-preview-shell .paper-picker-field.is-editable')).toHaveCount(0);
    await expect(page.locator('.print-preview-shell .live-record-card').first()).toBeVisible();

    watcher.assertNoSevereErrors();
  });

  test('冲突 chip 存在时可打开面板且不改变记录单主体宽度', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('samis.e2e', '1');
    });
    await openAnesthesiaRecord(page);
    await page.evaluate(async () => {
      const api = (window as Window & { __samisAnesthesiaE2E?: { injectConflict?: () => Promise<void> } }).__samisAnesthesiaE2E;
      await api?.injectConflict?.();
    });

    const beforeBox = await getRecordSheetBox(page);
    const conflictChip = page.locator('.record-status-bar .sync-chip').filter({ hasText: /冲突/ });
    await expect(conflictChip.first()).toBeVisible({ timeout: 10_000 });

    await conflictChip.first().click();
    await expect(page.locator('.arco-modal').filter({ hasText: '同步冲突' })).toBeVisible();
    const duringBox = await getRecordSheetBox(page);
    if (beforeBox && duringBox) {
      expect(Math.abs(duringBox.width - beforeBox.width)).toBeLessThan(24);
    }
    watcher.assertNoSevereErrors();
  });
});

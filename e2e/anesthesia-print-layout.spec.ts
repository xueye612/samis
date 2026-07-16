import { expect, test } from '@playwright/test';
import { watchConsoleErrors } from './helpers/consoleErrorWatcher';
import { getRecordSheetBox, openAnesthesiaRecord, startMonitorMockFromWorkbench, stopMonitorMockFromWorkbench } from './helpers/anesthesiaRecord';

test.describe('麻醉记录单打印与状态栏', () => {
  test.setTimeout(90_000);

  test('状态栏存在且不挤压打印主体，打印媒体下隐藏', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await openAnesthesiaRecord(page);

    await expect(page.locator('.record-status-bar')).toBeVisible();
    // 顶栏采用 inline 单槽摘要（.sync-summary），不再渲染多枚 .sync-chip
    await expect(page.locator('.record-status-bar .sync-summary')).toBeVisible();

    const beforeBox = await getRecordSheetBox(page);
    expect(beforeBox?.width).toBeGreaterThan(200);

    await startMonitorMockFromWorkbench(page);
    await expect(page.locator('.record-status-bar .sync-summary')).toBeVisible({ timeout: 15_000 });

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

    // 顶栏动作区已由 .top-primary-actions 改为 .clinical-actions，打印为直接按钮
    await page.locator('.record-workstation-topbar .clinical-actions').getByRole('button', { name: '打印' }).click();
    await expect(page.locator('.print-preview-shell')).toBeVisible();
    await expect(page.locator('.print-preview-page').first()).toBeVisible();

    // 打印预览激活后隐藏顶栏、状态栏与设备辅助区
    await expect(page.locator('.record-status-bar')).toBeHidden();
    await expect(page.locator('.device-workbench')).toBeHidden();
    await expect(page.locator('.realtime-device-panel')).toBeHidden();
    await expect(page.locator('.realtime-waveform-placeholder')).toBeHidden();

    // 纸面内不得出现可编辑选择器与任何交互控件
    await expect(page.locator('.print-preview-shell .paper-picker-trigger')).toHaveCount(0);
    await expect(page.locator('.print-preview-shell .paper-picker-action')).toHaveCount(0);
    await expect(page.locator('.print-preview-shell .paper-picker-field.is-editable')).toHaveCount(0);
    await expect(page.locator('.print-preview-page button, .print-preview-page .arco-btn, .print-preview-page input, .print-preview-page select, .print-preview-page textarea')).toHaveCount(0);
    await expect(page.locator('.print-preview-shell .live-record-card').first()).toBeVisible();

    watcher.assertNoSevereErrors();
  });

  test('冲突摘要存在时可打开面板且不改变记录单主体宽度', async ({ page }) => {
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
    // 冲突在 inline 摘要中以「冲突N」呈现
    const conflictSummary = page.locator('.record-status-bar .sync-summary').filter({ hasText: /冲突/ });
    await expect(conflictSummary.first()).toBeVisible({ timeout: 10_000 });

    await conflictSummary.first().click();
    await expect(page.locator('.arco-modal').filter({ hasText: '同步冲突' })).toBeVisible();
    const duringBox = await getRecordSheetBox(page);
    if (beforeBox && duringBox) {
      expect(Math.abs(duringBox.width - beforeBox.width)).toBeLessThan(24);
    }
    watcher.assertNoSevereErrors();
  });
});

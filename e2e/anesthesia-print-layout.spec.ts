import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { watchConsoleErrors } from './helpers/consoleErrorWatcher';
import { getRecordSheetBox, openAnesthesiaRecord, startMonitorMockFromQuickToolbar, stopMonitorMockFromQuickToolbar } from './helpers/anesthesiaRecord';

test.describe('麻醉记录单打印与状态栏', () => {
  test.setTimeout(90_000);

  test('状态栏存在且不挤压打印主体，打印媒体下隐藏', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await page.addInitScript(() => localStorage.setItem('samis.anesthesia.deviceRealtimeDataSource', 'simulation'));
    await page.route('**/quality/configGet?**', async (route) => {
      if (!route.request().url().includes('device_realtime_data_source')) return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, message: 'ok', data: { key: 'device_realtime_data_source', value: 'simulation', scope: 'global', source: 'e2e' } }),
      });
    });
    await openAnesthesiaRecord(page);
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));

    await expect(page.locator('.record-status-bar')).toBeVisible();
    // 顶栏采用 inline 单槽摘要（.sync-summary），不再渲染多枚 .sync-chip
    await expect(page.locator('.record-status-bar .sync-summary')).toBeVisible();

    const beforeBox = await page.locator('.sheet-workbench').boundingBox();
    const beforeDeviceBox = await page.getByTestId('record-realtime-device-panel').boundingBox();
    expect(beforeBox?.width).toBeGreaterThan(200);

    await startMonitorMockFromQuickToolbar(page);
    await expect(page.locator('.record-status-bar .sync-summary')).toBeVisible({ timeout: 15_000 });

    const duringBox = await page.locator('.sheet-workbench').boundingBox();
    const duringDeviceBox = await page.getByTestId('record-realtime-device-panel').boundingBox();
    if (beforeBox && duringBox) {
      // 1280px 临界视口允许适宽缩放取整带来的单级变化，但不得超过 2.5% 工作区宽度。
      expect(Math.abs(duringBox.width - beforeBox.width)).toBeLessThan(32);
    }
    expect(beforeDeviceBox?.height).toBe(210);
    expect(duringDeviceBox?.height).toBe(210);

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.record-status-bar')).toBeHidden();

    await page.emulateMedia({ media: 'screen' });
    await stopMonitorMockFromQuickToolbar(page);
    watcher.assertNoSevereErrors();
  });

  test('打印预览隐藏状态栏、设备面板与编辑痕迹', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('samis.e2e', '1');
      localStorage.setItem('samis.anesthesia.deviceRealtimeDataSource', 'simulation');
    });
    await page.route('**/quality/configGet?**', async (route) => {
      if (!route.request().url().includes('device_realtime_data_source')) return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, message: 'ok', data: { key: 'device_realtime_data_source', value: 'simulation', scope: 'global', source: 'e2e' } }),
      });
    });
    await openAnesthesiaRecord(page);
    await startMonitorMockFromQuickToolbar(page);

    // 顶栏动作区已由 .top-primary-actions 改为 .clinical-actions，打印为直接按钮
    await page.locator('.record-workstation-topbar .clinical-actions').getByRole('button', { name: '打印' }).click();
    await expect(page.locator('.print-preview-shell')).toBeVisible();
    await expect(page.locator('.print-preview-page').first()).toBeVisible();
    await expect(page.locator('.print-preview-toolbar')).toContainText('A4 竖向');

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

    const printPage = page.locator('.print-preview-page').first();
    const printPages = page.locator('.print-preview-pages');
    for (const requiredText of [
      '姓名', '性别', '年龄', '手术日期', '术前诊断', '拟施手术', '麻醉方法',
      '麻醉医师', '手术医师', '巡回护士', '洗手护士', '输液', '输血', '监测',
      '出入量', '麻醉诱导用药', '辅助及特殊用药', '手术关键操作', '术后镇痛',
    ]) {
      await expect(printPage, `打印预览缺少：${requiredText}`).toContainText(requiredText);
    }
    for (const requiredText of ['麻醉效果', '去向', '镇痛方式', '交班情况', '签名', '完成时间']) {
      await expect(printPages, `打印末页缺少：${requiredText}`).toContainText(requiredText);
    }

    // A4 竖向按较短时间窗分页，禁止把完整横向时间轴整体缩小到不可读。
    const firstPageGeometry = await page.locator('.print-preview-page').first().evaluate((pageElement) => {
      const pageRect = pageElement.getBoundingClientRect();
      const field = pageElement.querySelector('.paper-field-value');
      return {
        aspect: pageRect.width / pageRect.height,
        fieldFontSize: field ? Number.parseFloat(getComputedStyle(field).fontSize) : 0,
      };
    });
    expect(firstPageGeometry.aspect).toBeGreaterThan(0.68);
    expect(firstPageGeometry.aspect).toBeLessThan(0.74);
    expect(firstPageGeometry.fieldFontSize).toBeGreaterThanOrEqual(9.5);
    const previewPageCount = await page.locator('.print-preview-page').count();
    expect(previewPageCount).toBeGreaterThan(1);
    await expect(page.locator('.print-preview-page .record-header')).toHaveCount(previewPageCount);
    await expect(page.locator('.print-preview-page .record-footer-summary')).toHaveCount(1);
    await expect(page.locator('.print-preview-page').last().locator('.record-footer-summary')).toBeVisible();

    // 真正调用 Chromium 打印引擎，防止 DOM 预览看似一页、物理打印却把页脚拆成第二张残页。
    const pdf = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      margin: { top: '2mm', right: '2mm', bottom: '2mm', left: '2mm' },
    });
    const physicalPageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
    expect(physicalPageCount, '物理打印页数必须与竖版预览页数一致').toBe(previewPageCount);

    fs.mkdirSync(path.resolve('test-results/record-design'), { recursive: true });
    await printPage.screenshot({ path: path.resolve('test-results/record-design/record-print-a4-page-1.png') });
    await page.locator('.print-preview-page').last().screenshot({ path: path.resolve('test-results/record-design/record-print-a4-last-page.png') });

    watcher.assertNoSevereErrors();
  });

  test('冲突摘要存在时可打开面板且不改变记录单主体宽度', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('samis.e2e', '1');
    });
    await openAnesthesiaRecord(page);
    await expect.poll(() => page.evaluate(() => (
      typeof (window as Window & { __samisAnesthesiaE2E?: { injectConflict?: unknown } }).__samisAnesthesiaE2E?.injectConflict
    )), { timeout: 15_000 }).toBe('function');
    await page.evaluate(async () => {
      const api = (window as Window & { __samisAnesthesiaE2E?: { injectConflict?: () => Promise<void> } }).__samisAnesthesiaE2E;
      await api!.injectConflict!();
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

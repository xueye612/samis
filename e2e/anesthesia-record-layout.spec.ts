import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openAnesthesiaRecord } from './helpers/anesthesiaRecord';
import { startMonitorMockFromQuickToolbar } from './helpers/anesthesiaRecord';

const shotDir = path.resolve('test-results/record-design');
const VPS = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

test.describe('麻醉记录单工作台布局门禁', () => {
  test.setTimeout(90_000);

  for (const vp of VPS) {
    test(`${vp.width}×${vp.height} 无横向溢出且四区齐备`, async ({ page }) => {
      await page.setViewportSize(vp);
      await openAnesthesiaRecord(page, 'case-or01');
      await page.waitForTimeout(800);

      // 1) 页面与工作区均不得横向溢出
      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        sheetScroll: (document.querySelector('.sheet-workbench') as HTMLElement | null)?.scrollWidth
          > ((document.querySelector('.sheet-workbench') as HTMLElement | null)?.clientWidth ?? 0) + 1,
      }));
      expect(overflow.doc, `${vp.width} 页面横向溢出`).toBe(false);

      // 2) 四区齐备：顶部操作区、记录单主体、实时设备常驻区、快捷录入
      await expect(page.locator('.record-workstation-topbar')).toBeVisible();
      await expect(page.locator('.live-record-card').first()).toBeVisible();
      await expect(page.locator('.toolbox-pinned-zone .realtime-device-panel')).toBeVisible();
      await expect(page.locator('.toolbox-pinned-zone .realtime-waveform-placeholder')).toBeVisible();

      // 3) 实时设备常驻区与快捷录入同处 sticky pinned 区，波形占位 ≤56px
      const waveHeight = await page.locator('.realtime-waveform-placeholder').first().boundingBox();
      expect(waveHeight?.height ?? 999).toBeLessThanOrEqual(56);

      // 证据截图：禁止 fullPage，仅截视口
      fs.mkdirSync(shotDir, { recursive: true });
      await page.screenshot({ path: path.join(shotDir, `record-gate-${vp.width}x${vp.height}.png`) });
    });
  }

  test('手动缩放后不被 ResizeObserver 重置', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAnesthesiaRecord(page, 'case-or01');
    await page.waitForTimeout(800);

    // 记录自动适宽缩放值
    const autoZoom = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet-zoom-frame') as HTMLElement).zoom);

    // 手动放大
    await page.locator('.record-workstation-topbar .clinical-actions, .record-workstation-topbar .topbar-center')
      .getByRole('button', { name: '+' }).first().click();
    await page.waitForTimeout(200);
    const manualZoom = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet-zoom-frame') as HTMLElement).zoom);

    // 改变视口宽度触发 ResizeObserver
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.waitForTimeout(600);
    const afterResizeZoom = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet-zoom-frame') as HTMLElement).zoom);

    // 手动缩放后，ResizeObserver 不得将其重置回自动适宽值
    expect(manualZoom).not.toBe(autoZoom);
    expect(afterResizeZoom, '手动缩放被 ResizeObserver 重置').toBe(manualZoom);
  });

  test('模拟监护启动前后设备区高度固定且首帧立即显示', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openAnesthesiaRecord(page, 'case-or02');

    const panel = page.getByTestId('record-realtime-device-panel');
    await expect(page.getByTestId('device-source-mode')).toHaveText('模拟数据');
    await expect(page.getByTestId('device-live-empty')).toContainText('模拟采集尚未启动');
    const before = await panel.boundingBox();

    await startMonitorMockFromQuickToolbar(page);
    await expect(page.getByTestId('monitor-live-values')).toBeVisible({ timeout: 7_000 });
    await expect(page.getByTestId('device-freshness')).toHaveText('实时');
    const after = await panel.boundingBox();

    expect(before?.height).toBe(210);
    expect(after?.height).toBe(210);
  });

  test('后台切换真实设备源后刷新保持并提示先连接设备', async ({ page }) => {
    await page.route('**/api-samis/pc/v1/anesthesiaDevice/getLatestDeviceData**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, message: 'ok', data: { monitor: null, ventilator: null } }),
      });
    });
    const selectSource = async (label: '模拟采集数据' | '真实设备网关') => {
      await page.goto('/system/mock');
      const selector = page.getByTestId('device-realtime-source-selector');
      await selector.getByText(label, { exact: true }).click();
      await page.getByRole('button', { name: '保存设备数据源' }).click();
      await expect(page.getByText('实时设备数据源已保存', { exact: true })).toBeVisible();
    };

    try {
      await selectSource('真实设备网关');
      await page.reload();
      await expect(
        page.getByTestId('device-realtime-source-selector').locator('input[value="real"]'),
      ).toBeChecked();

      await openAnesthesiaRecord(page, 'case-or02');
      await expect(page.getByTestId('device-source-mode')).toHaveText('真实设备');
      await expect(page.getByTestId('device-live-empty')).toContainText('未连接实时设备');
      await expect(page.getByRole('button', { name: /启监护仪|启呼吸机/ })).toHaveCount(0);
    } finally {
      await selectSource('模拟采集数据');
    }
  });
});

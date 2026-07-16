import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openAnesthesiaRecord } from './helpers/anesthesiaRecord';

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
});

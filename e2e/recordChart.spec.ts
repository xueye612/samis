import { expect, test } from '@playwright/test';
import { watchConsoleErrors } from './helpers/consoleErrorWatcher';
import { corePages } from './helpers/pages';

const recordPage = corePages.find((item) => item.path.startsWith('/surgery/record'))!;

test.describe('麻醉记录单 — 拆分后子组件仍正常工作', () => {
  test('图例、网格、趋势图与状态符号均能渲染', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await page.goto(recordPage.path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.waitForTimeout(400);

    const sheet = page.locator('.live-record-card').first();
    await expect(sheet).toBeVisible();

    // 图例（已拆分为 RecordChartLegend 子组件）
    const legend = page.locator('.chart-legend-panel').first();
    await expect(legend).toBeVisible();
    await expect(legend.locator('.room-entry-legend span').first()).toContainText('手术室');

    // 趋势图与网格线（GridLines 子组件 + useVitalChartDrawing 绘制）
    await expect(page.locator('.chart-area svg').first()).toBeVisible();
    const drawn = await page.locator('.chart-area svg polyline, .chart-area svg path').count();
    expect(drawn).toBeGreaterThan(0);
    expect(await page.locator('.print-grid-lines').count()).toBeGreaterThan(0);

    watcher.assertNoSevereErrors();
  });

  test('右键纸面弹出交互层菜单（RecordContextMenu 子组件）', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await page.goto(recordPage.path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    await page.waitForTimeout(400);

    const medicationTrack = page.locator('.medication-band .band-track').first();
    await expect(medicationTrack).toBeVisible();
    await medicationTrack.click({ button: 'right', position: { x: 60, y: 20 } });

    const menu = page.locator('.live-context-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByText('新增用药')).toBeVisible();

    watcher.assertNoSevereErrors();
  });
});

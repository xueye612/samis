import { expect, test } from '@playwright/test';
import { watchConsoleErrors } from './helpers/consoleErrorWatcher';
import {
  openAnesthesiaRecord,
  readPatientSnapshot,
  ensureRecordUnlocked,
  startMonitorMockFromWorkbench,
  stopMonitorMockFromWorkbench,
  startVentilatorMockFromWorkbench,
  stopVentilatorMockFromWorkbench,
} from './helpers/anesthesiaRecord';

test.describe('麻醉设备模拟边界', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('samis.anesthesia.deviceRealtimeDataSource', 'simulation'));
    await page.route('**/quality/configGet?**', async (route) => {
      if (!route.request().url().includes('device_realtime_data_source')) return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, message: 'ok', data: { key: 'device_realtime_data_source', value: 'simulation', scope: 'global', source: 'e2e' } }),
      });
    });
  });

  test('监护仪模拟不修改患者/手术信息', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await openAnesthesiaRecord(page);
    await ensureRecordUnlocked(page);

    const before = await readPatientSnapshot(page);
    expect(before.name).toBeTruthy();

    await startMonitorMockFromWorkbench(page);
    await expect(page.locator('.device-workbench strong').filter({ hasText: '运行中' }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(12_000);

    const after = await readPatientSnapshot(page);
    expect(after.name).toBe(before.name);
    expect(after.gender).toBe(before.gender);
    expect(after.age).toBe(before.age);
    expect(after.diagnosis).toBe(before.diagnosis);
    expect(after.surgery).toBe(before.surgery);

    await stopMonitorMockFromWorkbench(page);
    watcher.assertNoSevereErrors();
  });

  test('呼吸机模拟不修改患者/手术信息', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await openAnesthesiaRecord(page);
    await ensureRecordUnlocked(page);

    const before = await readPatientSnapshot(page);
    await startVentilatorMockFromWorkbench(page);
    await expect(page.locator('.device-workbench strong').filter({ hasText: '运行中' }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(12_000);

    const after = await readPatientSnapshot(page);
    expect(after.name).toBe(before.name);
    expect(after.gender).toBe(before.gender);
    expect(after.age).toBe(before.age);
    expect(after.diagnosis).toBe(before.diagnosis);
    expect(after.surgery).toBe(before.surgery);

    await stopVentilatorMockFromWorkbench(page);
    watcher.assertNoSevereErrors();
  });

  test('未打开有效记录时不能启动设备模拟', async ({ page }) => {
    await page.goto('/surgery/record/invalid-case-id', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load');
    const startButton = page.getByRole('button', { name: '启动监护仪' });
    if (await startButton.isVisible()) {
      await startButton.click();
      await expect(page.locator('.arco-message').filter({ hasText: /请先打开或创建麻醉记录单/ })).toBeVisible({
        timeout: 5000,
      });
    }
  });
});


import { expect, test } from '@playwright/test';
import { watchConsoleErrors } from './helpers/consoleErrorWatcher';
import {
  addFirstQuickEvent,
  openAnesthesiaRecord,
  readPatientSnapshot,
  waitForLocalSavedChip,
  startMonitorMockFromWorkbench,
  stopMonitorMockFromWorkbench,
} from './helpers/anesthesiaRecord';

test.describe('麻醉记录单持久化', () => {
  test.setTimeout(120_000);

  test('刷新后事件与生命体征仍在，且不出现 hydration 骨架回闪', async ({ page }) => {
    const watcher = watchConsoleErrors(page);
    await openAnesthesiaRecord(page);

    const snapshotBefore = await readPatientSnapshot(page);
    expect(snapshotBefore.name.length).toBeGreaterThan(0);

    await addFirstQuickEvent(page);
    await expect(page.locator('.record-status-bar')).toBeVisible();

    await startMonitorMockFromWorkbench(page);
    await page.waitForTimeout(6000);
    await stopMonitorMockFromWorkbench(page);
    await waitForLocalSavedChip(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.anesthesia-record-workstation')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.sheet-hydration-shell')).toHaveCount(0, { timeout: 45_000 });
    await expect(page.locator('.live-record-card').first()).toBeVisible({ timeout: 15_000 });

    const snapshotAfter = await readPatientSnapshot(page);
    expect(snapshotAfter.name).toBe(snapshotBefore.name);
    expect(snapshotAfter.gender).toBe(snapshotBefore.gender);
    expect(snapshotAfter.age).toBe(snapshotBefore.age);
    expect(snapshotAfter.diagnosis).toBe(snapshotBefore.diagnosis);
    expect(snapshotAfter.surgery).toBe(snapshotBefore.surgery);
    await expect(page.locator('.sheet-hydration-shell')).toHaveCount(0);

    watcher.assertNoSevereErrors();
  });
});

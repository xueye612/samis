import { expect, test } from '@playwright/test';
import { openAnesthesiaRecord } from './helpers/anesthesiaRecord';

test.describe('麻醉记录单实时设备数值', () => {
  test('无设备数据时明确显示空状态且不伪造数值', async ({ page }) => {
    await openAnesthesiaRecord(page);
    const panel = page.getByTestId('record-realtime-device-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('device-source-mode')).toHaveText('模拟数据');
    await expect(page.getByTestId('device-freshness')).toHaveText('无数据');
    await expect(page.getByTestId('device-live-empty')).toContainText('模拟采集尚未启动');
    await expect(page.getByTestId('monitor-live-values')).toHaveCount(0);
    await expect(page.getByTestId('ventilator-live-values')).toHaveCount(0);
  });

  test('实时设备面板不进入打印媒体', async ({ page }) => {
    await openAnesthesiaRecord(page);
    await expect(page.getByTestId('record-realtime-device-panel')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('record-realtime-device-panel')).toBeHidden();
  });
});

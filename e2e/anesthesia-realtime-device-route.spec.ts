import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { openAnesthesiaRecord } from './helpers/anesthesiaRecord';

const shotDir = path.resolve('test-results/record-design');

/** 服务器与浏览器均为 Asia/Shanghai；返回 +08:00 的 'YYYY-MM-DD HH:mm:ss' 采集时间。 */
function beijingClock(offsetSeconds = 0): string {
  const d = new Date(Date.now() + offsetSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const monitor = (offset: number) => ({
  operationId: 'case-or01', deviceId: 'MON-OR01', sourceDevice: 'Philips MX800',
  collectTime: beijingClock(offset),
  hr: 78, pulse: 80, sbp: 120, dbp: 78, mapValue: 92, spo2: 99, temperature: 36.6, respiration: 14, bis: 45, etco2: 34,
});
const ventilator = (offset: number) => ({
  operationId: 'case-or01', deviceId: 'VENT-OR01', sourceDevice: 'Drager Perseus',
  collectTime: beijingClock(offset),
  ventMode: 'VCV', tidalVolume: 480, respiratoryRate: 12, fio2: 50, peep: 5, peakPressure: 18, plateauPressure: 14, minuteVolume: 5.8, airwayPressure: 16, etco2: 36,
});

const ok = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ code: 0, msg: 'ok', data }),
});

type Mode = 'live' | 'delayed' | 'offline' | 'empty';

async function installDeviceRoute(page: Page, mode: Mode) {
  // 后台配置是设备来源的权威值；仅写 localStorage 会在页面启动后被配置 GET 覆盖。
  await page.route('**/api-samis/pc/v1/quality/configGet**', async (route) => {
    await route.fulfill(ok({ key: 'device_realtime_data_source', value: 'real', scope: 'global', source: 'mock' }));
  });
  await page.route('**/api-samis/pc/v1/anesthesiaDevice/getLatestDeviceData**', async (route) => {
    let data: unknown;
    if (mode === 'empty') {
      data = { operationId: 'case-or01', monitor: null, ventilator: null };
    } else {
      // live: age 0s；delayed: age 30s；offline: age 120s（阈值 15s/60s）
      const offset = mode === 'live' ? 0 : mode === 'delayed' ? -30 : -120;
      data = { operationId: 'case-or01', monitor: monitor(offset), ventilator: ventilator(offset) };
    }
    await route.fulfill(ok(data));
  });
}

const EXPECTED: Record<Mode, string> = { live: '实时', delayed: '延迟', offline: '离线', empty: '无数据' };

test.describe('麻醉记录单实时设备数值（route 注入四态）', () => {
  test.setTimeout(60_000);

  for (const mode of ['live', 'delayed', 'offline', 'empty'] as Mode[]) {
    test(`${mode} 态：通过 route 提供数值并校验新鲜度与字段`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('samis.anesthesia.deviceRealtimeDataSource', 'real');
      });
      await installDeviceRoute(page, mode);
      await page.setViewportSize({ width: 1440, height: 900 });
      await openAnesthesiaRecord(page, 'case-or01');

      // 等待轮询（3s）回填
      await expect(page.getByTestId('device-freshness')).toHaveText(EXPECTED[mode], { timeout: 15_000 });

      if (mode === 'empty') {
        await expect(page.getByTestId('device-live-empty')).toContainText('未连接实时设备');
        await expect(page.getByTestId('monitor-live-values')).toHaveCount(0);
        await expect(page.getByTestId('ventilator-live-values')).toHaveCount(0);
      } else {
        // 监护仪 7 项 + 呼吸机 9 项数值全部呈现，且不伪造为空
        await expect(page.getByTestId('monitor-live-values')).toBeVisible();
        await expect(page.getByTestId('ventilator-live-values')).toBeVisible();
        const monitorCells = await page.getByTestId('monitor-live-values').locator('.metric-cell').count();
        const ventCells = await page.getByTestId('ventilator-live-values').locator('.metric-cell').count();
        expect(monitorCells).toBeGreaterThanOrEqual(7);
        expect(ventCells).toBeGreaterThanOrEqual(9);
      }

      // 设备面板截图（元素级，非 fullPage）
      await page.getByTestId('record-realtime-device-panel').screenshot({ path: path.join(shotDir, `device-${mode}.png`) });
    });
  }
});

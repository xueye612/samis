import { expect, test } from '@playwright/test';
import { login, postOnPathname } from './helpers/realIntegration';

/**
 * 麻醉记录浏览器 UI 真实闭环冒烟。
 *
 * 默认跳过：不登录、不写库。
 * 真实运行必须显式 opt-in：
 *   VITE_SAMIS_REAL_INTEGRATION=1
 *   VITE_USE_REAL_ANESTHESIA_RECORD=true
 *   VITE_USE_REAL_ANESTHESIA_SYNC=true
 *   VITE_USE_REAL_AUTH=true
 *   VITE_SAMIS_API_BASE=http://192.168.10.178:8022/api-samis/pc/v1
 */

const env = process.env;
const REAL_INTEGRATION = env.VITE_SAMIS_REAL_INTEGRATION === '1' || env.SAMIS_REAL_INTEGRATION === '1';
const REAL_RECORD = env.VITE_USE_REAL_ANESTHESIA_RECORD === 'true';
const REAL_SYNC = env.VITE_USE_REAL_ANESTHESIA_SYNC === 'true';
const REAL_AUTH = env.VITE_USE_REAL_AUTH === 'true';
const SHOULD_RUN_REAL = REAL_INTEGRATION && REAL_RECORD && REAL_SYNC && REAL_AUTH;
const API_BASE = (
  env.SAMIS_E2E_API_BASE
  || (env.VITE_SAMIS_API_BASE?.startsWith('http') ? env.VITE_SAMIS_API_BASE : undefined)
  || 'http://192.168.10.178:8022/api-samis/pc/v1'
).replace(/\/+$/, '');

interface UiSmokeHarness {
  saveUiSmokeSynthetic: (operationId: string) => Promise<{
    operationId: string;
    recordLocalId: string;
    local: {
      record: boolean;
      queueEntityTypes: string[];
    };
  }>;
}

interface RecordDetailResponse {
  operationId: string;
  record: null | {
    localId?: string;
    recordLocalId?: string;
    timelineEvents?: Array<{ localId?: string }>;
    medications?: Array<{ localId?: string }>;
    vitalSigns?: Array<{ localId?: string }>;
  };
}

function timestampId(): string {
  const now = new Date();
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    pad(now.getMilliseconds(), 3),
  ].join('');
}

async function readToken(page: import('@playwright/test').Page): Promise<string> {
  const token = await page.evaluate(() => sessionStorage.getItem('samis_token') || '');
  expect(token).toMatch(/^eyJ/);
  return token;
}

async function apiGetRecordDetail(request: import('@playwright/test').APIRequestContext, token: string, operationId: string) {
  const response = await request.get(`${API_BASE}/anesthesiaRecord/getRecordDetail`, {
    headers: {
      Authorization: `Bearer ${token}`,
      token,
    },
    params: { operationId },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.code).toBe(0);
  return body.data as RecordDetailResponse;
}

async function apiVoidRecord(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  operationId: string,
  recordLocalId: string,
) {
  const response = await request.post(`${API_BASE}/anesthesiaRecord/voidRecord`, {
    headers: {
      Authorization: `Bearer ${token}`,
      token,
      'Content-Type': 'application/json',
    },
    data: {
      operationId,
      recordLocalId,
      voidReason: 'ui real smoke cleanup',
    },
  });
  const body = await response.json();
  if (!response.ok() && body?.message === '记录不存在') return;
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  expect(body.code).toBe(0);
  expect(body.data?.voided).toBe(true);
}

test.describe('anesthesia UI real smoke', () => {
  test.skip(!SHOULD_RUN_REAL, 'explicit real integration opt-in is required; default mode must not login or write data');

  test('saves a synthetic anesthesia record through browser persistence and real pushBatch', async ({ page, request }) => {
    test.setTimeout(90_000);
    const operationId = `OP-E2E-UI-SMOKE-${timestampId()}`;
    let token = '';
    let recordLocalId = operationId;

    try {
      await login(page);
      await expect(page).toHaveURL(/\/workbench\/overview/);
      token = await readToken(page);

      await page.goto('/surgery/record', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(
        (window as Window & { __samisAnesthesiaE2E?: UiSmokeHarness }).__samisAnesthesiaE2E?.saveUiSmokeSynthetic,
      ), { timeout: 30_000 });

      const pushBatchResp = page.waitForResponse((response) => (
        postOnPathname('/anesthesiaSync/pushBatch')(response) && response.status() === 200
      ), { timeout: 30_000 });
      const saved = await page.evaluate(async (id) => {
        const harness = (window as Window & { __samisAnesthesiaE2E?: UiSmokeHarness }).__samisAnesthesiaE2E;
        if (!harness?.saveUiSmokeSynthetic) throw new Error('UI smoke harness is unavailable');
        return harness.saveUiSmokeSynthetic(id);
      }, operationId);
      recordLocalId = saved.recordLocalId;
      const pushResponse = await pushBatchResp;
      const pushBody = await pushResponse.json();

      expect(saved.operationId).toBe(operationId);
      expect(saved.recordLocalId).toBe(operationId);
      expect(saved.local.record).toBe(true);
      expect(saved.local.queueEntityTypes).toEqual(expect.arrayContaining([
        'record',
        'timeline_event',
        'medication',
        'vital_sign',
      ]));
      expect(pushBody.code).toBe(0);
      expect(pushBody.data?.results?.every((item: { status?: string }) => item.status === 'success')).toBe(true);

      const detail = await apiGetRecordDetail(request, token, operationId);
      expect(detail.operationId).toBe(operationId);
      expect(detail.record).toBeTruthy();
      expect(detail.record?.localId || detail.record?.recordLocalId).toBe(recordLocalId);
      expect(detail.record?.timelineEvents?.some((item) => item.localId === `timeline-e2e-ui-${operationId}`)).toBe(true);
      expect(detail.record?.medications?.some((item) => item.localId === `med-e2e-ui-${operationId}`)).toBe(true);
      expect(detail.record?.vitalSigns?.some((item) => item.localId === `vital-e2e-ui-${operationId}`)).toBe(true);
    } finally {
      if (token) {
        const beforeCleanup = await apiGetRecordDetail(request, token, operationId);
        if (beforeCleanup.record) {
          await apiVoidRecord(request, token, operationId, recordLocalId);
        }
        const afterCleanup = await apiGetRecordDetail(request, token, operationId);
        expect(afterCleanup.record).toBeNull();
      }
    }
  });
});

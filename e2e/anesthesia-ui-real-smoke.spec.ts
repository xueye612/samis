import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { getOnPathname, login, postOnPathname } from './helpers/realIntegration';

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
  saveUiSmokeCurrent: (operationId: string) => Promise<{
    operationId: string;
    recordLocalId: string;
    local: {
      record: boolean;
      queueEntityTypes: string[];
    };
  }>;
  reloadUiSmokeFromServer: (operationId: string) => Promise<{
    operationId: string;
    record: boolean;
    timelineEvents: number;
    medications: number;
    vitalSigns: number;
  }>;
}

interface FixtureRoom {
  OPERATION_ROOM_CODE: string;
  OPERATION_ROOM_NAME?: string;
  OPERATION_ROOM_GROUP?: string;
}

interface OperationListRow {
  OPERATIONID?: string;
  operationCase?: { operationId?: string };
  operationTimeline?: Record<string, unknown>;
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

async function prepareFixtureAccess(request: import('@playwright/test').APIRequestContext) {
  const loginResponse = await request.post(`${API_BASE}/admin/login`, {
    form: {
      username: env.SAMIS_E2E_USERNAME || 'quality_admin',
      password: env.SAMIS_E2E_PASSWORD || 'samis2026',
    },
  });
  const loginBody = await loginResponse.json();
  expect(loginBody.code, JSON.stringify(loginBody)).toBe(0);
  const token = loginBody.data?.token || loginBody.data?.userInfo?.token;
  expect(token).toMatch(/^eyJ/);
  const roomResponse = await request.get(`${API_BASE}/room/getRoomList`, {
    headers: { Authorization: `Bearer ${token}`, token },
  });
  const roomBody = await roomResponse.json();
  expect(roomBody.code, JSON.stringify(roomBody)).toBe(0);
  const room = (roomBody.data as FixtureRoom[]).find((item) => item.OPERATION_ROOM_CODE);
  expect(room, 'authenticated room catalog must contain a fixture-visible room').toBeTruthy();
  return { token: token as string, room: room! };
}

function runScheduleFixture(action: 'setup' | 'cleanup' | 'status', operationId: string, room?: FixtureRoom) {
  const args = ['exec', '-e', 'SAMIS_E2E_SCHEDULE_FIXTURE=1'];
  if (room) {
    args.push(
      '-e', `SAMIS_E2E_ROOM_CODE=${room.OPERATION_ROOM_CODE}`,
      '-e', `SAMIS_E2E_ROOM_NAME=${room.OPERATION_ROOM_NAME || room.OPERATION_ROOM_CODE}`,
      '-e', `SAMIS_E2E_ROOM_GROUP=${room.OPERATION_ROOM_GROUP || ''}`,
      '-e', `SAMIS_E2E_ROOM_GROUP_NAME=${room.OPERATION_ROOM_GROUP || ''}`,
    );
  }
  args.push(
    '-w', '/www/sites/api.cnwenhui.cn/index',
    '1Panel-php8-B01L',
    'php', 'tests/operation_schedule_fixture.php', action, operationId,
  );
  const output = execFileSync('docker', args, { encoding: 'utf8' }).trim();
  return JSON.parse(output) as { status: string; operationId?: string; visible?: boolean };
}

async function apiOperationList(
  request: import('@playwright/test').APIRequestContext,
  token: string,
): Promise<OperationListRow[]> {
  const response = await request.get(`${API_BASE}/operationInfo/getOperationList`, {
    headers: { Authorization: `Bearer ${token}`, token },
    params: { operationDate: new Date().toISOString().slice(0, 10), page_size: 500 },
  });
  const body = await response.json();
  expect(body.code, JSON.stringify(body)).toBe(0);
  return body.data?.list || [];
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

  test('enters a real schedule case and completes anesthesia save sync readback cleanup', async ({ page, request }) => {
    test.setTimeout(120_000);
    const operationId = `OP-E2E-SCHEDULE-${timestampId()}`;
    let token = '';
    let fixtureToken = '';
    let fixtureCreated = false;
    let recordLocalId = operationId;

    try {
      const fixtureAccess = await prepareFixtureAccess(request);
      fixtureToken = fixtureAccess.token;
      const created = runScheduleFixture('setup', operationId, fixtureAccess.room);
      expect(created.status).toBe('created');
      fixtureCreated = true;
      const createdRows = await apiOperationList(request, fixtureToken);
      const fixtureRow = createdRows.find((item) => item.OPERATIONID === operationId);
      expect(fixtureRow, `real schedule list must contain ${operationId}`).toBeTruthy();
      expect(fixtureRow?.operationCase?.operationId).toBe(operationId);
      expect(fixtureRow?.operationTimeline).toBeTruthy();

      await login(page);
      await expect(page).toHaveURL(/\/workbench\/overview/);
      token = await readToken(page);

      const listResponsePromise = page.waitForResponse(getOnPathname('/operationInfo/getOperationList'));
      await page.goto('/surgery/schedule', { waitUntil: 'domcontentloaded' });
      const listResponse = await listResponsePromise;
      expect(listResponse.ok()).toBe(true);

      const scheduleRow = page.getByRole('row').filter({ hasText: 'OP-E2E-SCHEDULE-自然入口患者' });
      await expect(scheduleRow).toBeVisible();
      await scheduleRow.getByRole('button', { name: '麻醉记录单' }).click();
      await expect(page).toHaveURL(new RegExp(`/surgery/record/${operationId}`));
      await page.waitForFunction(() => Boolean(
        (window as Window & { __samisAnesthesiaE2E?: UiSmokeHarness }).__samisAnesthesiaE2E?.saveUiSmokeCurrent,
      ), { timeout: 30_000 });

      const pushBatchResp = page.waitForResponse((response) => (
        postOnPathname('/anesthesiaSync/pushBatch')(response) && response.status() === 200
      ), { timeout: 30_000 });
      const saved = await page.evaluate(async (id) => {
        const harness = (window as Window & { __samisAnesthesiaE2E?: UiSmokeHarness }).__samisAnesthesiaE2E;
        if (!harness?.saveUiSmokeCurrent) throw new Error('UI smoke current-case harness is unavailable');
        return harness.saveUiSmokeCurrent(id);
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

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(
        (window as Window & { __samisAnesthesiaE2E?: UiSmokeHarness }).__samisAnesthesiaE2E?.reloadUiSmokeFromServer,
      ), { timeout: 30_000 });
      const reloaded = await page.evaluate(async (id) => {
        const harness = (window as Window & { __samisAnesthesiaE2E?: UiSmokeHarness }).__samisAnesthesiaE2E;
        if (!harness?.reloadUiSmokeFromServer) throw new Error('UI smoke reload harness is unavailable');
        return harness.reloadUiSmokeFromServer(id);
      }, operationId);
      expect(reloaded).toEqual({
        operationId,
        record: true,
        timelineEvents: 1,
        medications: 1,
        vitalSigns: 1,
      });
    } finally {
      try {
        if (token) {
          const beforeCleanup = await apiGetRecordDetail(request, token, operationId);
          if (beforeCleanup.record) {
            await apiVoidRecord(request, token, operationId, recordLocalId);
          }
          const afterCleanup = await apiGetRecordDetail(request, token, operationId);
          expect(afterCleanup.record).toBeNull();
        }
      } finally {
        if (fixtureCreated) {
          const cleaned = runScheduleFixture('cleanup', operationId);
          expect(cleaned.status).toBe('deleted');
          expect(cleaned.visible).toBe(false);
          const status = runScheduleFixture('status', operationId);
          expect(status.status).toBe('absent');
          if (fixtureToken || token) {
            const rows = await apiOperationList(request, fixtureToken || token);
            expect(rows.some((item) => item.OPERATIONID === operationId)).toBe(false);
          }
        }
      }
    }
  });
});

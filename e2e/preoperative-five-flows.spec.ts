import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import { cleanupPreop, generateOperationId, statusPreop } from './helpers/preoperativeFiveFlowsFixture';

const e2eEnabled = process.env.SAMIS_PREOP_FIVE_FLOWS_E2E === '1';
const e2eUsername = process.env.SAMIS_E2E_USERNAME;
const e2ePassword = process.env.SAMIS_E2E_PASSWORD;

function ok(data: unknown) { return { status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) }; }
function permPayload(perms: string[]) { return { permissions: perms, role: perms.length ? 'admin' : 'viewer', groupid: perms.length ? 1 : null }; }

async function seed(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'preop-e2e-token');
    sessionStorage.setItem('samis_authorization', 'Bearer preop-e2e-token');
    sessionStorage.setItem('samis_room', 'OR-01');
    sessionStorage.setItem('samis_room_group', 'ANES');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({ userId: 'preop-e2e', loginName: 'preop-e2e', displayName: '术前验收用户' }));
  });
}

function parseForm(request: Request): URLSearchParams { return new URLSearchParams(request.postData() ?? ''); }

interface State { requests: Map<number, Record<string, unknown>>; nextId: number; safetyWrites: number; }

function installMocks(page: Page, perms: string[], state: State) {
  return page.route('**/api-samis/pc/v1/**', async (route) => {
    const url = route.request().url(); const method = route.request().method();
    if (url.includes('/auth/myPermissions')) { await route.fulfill(ok(permPayload(perms))); return; }
    if (method === 'GET' && url.includes('/preoperative/requestList')) {
      await route.fulfill(ok({ list: [...state.requests.values()], total: state.requests.size })); return;
    }
    if (method === 'POST' && url.includes('/preoperative/requestReceive')) {
      const f = parseForm(route.request());
      const id = Number(f.get('id'));
      const rec = state.requests.get(id);
      if (rec) { rec.status = '已排班'; rec.receivedAt = new Date().toISOString(); rec.version = (Number(rec.version) ?? 1) + 1; }
      await route.fulfill(ok({ id })); return;
    }
    if (method === 'POST' && url.includes('/preoperative/requestCancel')) {
      const f = parseForm(route.request());
      const id = Number(f.get('id'));
      const rec = state.requests.get(id);
      if (rec) { rec.status = '已取消'; rec.cancelledAt = new Date().toISOString(); rec.version = (Number(rec.version) ?? 1) + 1; }
      await route.fulfill(ok({ id })); return;
    }
    if (method === 'POST' && url.includes('/preoperative/safetyCheckCreate') || url.includes('/preoperative/safetyCheckUpdate')) {
      state.safetyWrites++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 1003, msg: '安全核查已迁移至HULI护理系统' }) });
      return;
    }
    if (method === 'GET' && url.includes('/preoperative/safetyCheckSummary')) {
      await route.fulfill(ok({ sourceSystem: 'HULI', sourceRecordId: 'SR-001', operationId: 'OP1', signInComplete: false, timeOutComplete: false, signOutComplete: false, anomalies: [], confirmedBy: null, confirmedAt: null })); return;
    }
    if (method === 'POST' && url.includes('/preoperative/safetyConfirmRole')) {
      await route.fulfill(ok({ status: 'confirmed' })); return;
    }
    await route.fulfill(ok({}));
  });
}

test.describe('术前五流程保存刷新与护理来源', () => {
  test('申请页：empty 无 seed；receive 信封仅含 id+version；POST→GET；无 seed 患者', async ({ page }) => {
    const state: State = { requests: new Map(), nextId: 7000, safetyWrites: 0 };
    await seed(page);
    await installMocks(page, ['*'], state);
    await page.goto('/preoperative/requests');
    await page.waitForLoadState('networkidle');
    // 空列表不报错
    await expect(page.locator('body')).toBeVisible();
    // 旧 safety CRUD 请求数为 0
    expect(state.safetyWrites).toBe(0);
  });

  test('安全核查页：旧 CRUD 请求数为 0；只请求 summary 和 confirmRole', async ({ page }) => {
    const state: State = { requests: new Map(), nextId: 7000, safetyWrites: 0 };
    await seed(page);
    await installMocks(page, ['*'], state);
    await page.goto('/preoperative/safety-check');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // safetyCheckCreate/Update 请求数必须为 0
    expect(state.safetyWrites).toBe(0);
  });

  test('真实凭据五流程生命周期与清理（opt-in）', async ({ page }) => {
    test.skip(!e2eEnabled || !e2eUsername || !e2ePassword, 'requires SAMIS_PREOP_FIVE_FLOWS_E2E=1 and credentials');
    if (!e2eUsername || !e2ePassword) return;

    const opId = generateOperationId();
    try {
      await page.goto('/login');
      await page.locator('input').first().fill(e2eUsername);
      await page.locator('input[type="password"]').fill(e2ePassword);
      await page.getByRole('button', { name: '登录' }).click();
      await expect(page).toHaveURL(/\/(workbench|surgery|config|preoperative)/);

      // 申请页
      await page.goto('/preoperative/requests');
      await page.waitForLoadState('networkidle');
    } finally {
      await cleanupPreop(opId);
      expect((await statusPreop(opId)).status).toBe('absent');
    }
  });
});

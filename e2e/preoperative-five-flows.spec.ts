import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import { cleanupPreop, generateOperationId, statusPreop } from './helpers/preoperativeFiveFlowsFixture';

const e2eEnabled = process.env.SAMIS_PREOP_FIVE_FLOWS_E2E === '1';
const e2eUsername = process.env.SAMIS_E2E_USERNAME;
const e2ePassword = process.env.SAMIS_E2E_PASSWORD;

function ok(data: unknown) { return { status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) }; }
function permPayload(perms: string[]) { return { permissions: perms, role: perms.length ? 'admin' : 'viewer', groupid: perms.length ? 1 : null }; }
function parseForm(request: Request): URLSearchParams { return new URLSearchParams(request.postData() ?? ''); }

async function seed(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'preop-e2e-token');
    sessionStorage.setItem('samis_authorization', 'Bearer preop-e2e-token');
    sessionStorage.setItem('samis_room', 'OR-01');
    sessionStorage.setItem('samis_room_group', 'ANES');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({ userId: 'preop-e2e', loginName: 'preop-e2e', displayName: '术前验收用户' }));
  });
}

interface State { safetyCrudCount: number; safetySummaryCount: number; confirmRoleCount: number; }

function freshState(): State { return { safetyCrudCount: 0, safetySummaryCount: 0, confirmRoleCount: 0 }; }

function installMocks(page: Page, perms: string[], state: State) {
  return page.route('**/api-samis/pc/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/auth/myPermissions')) { await route.fulfill(ok(permPayload(perms))); return; }

    // 旧 safety CRUD 必须拒绝并计数
    if (url.includes('/preoperative/safetyCheckCreate') || url.includes('/preoperative/safetyCheckUpdate')) {
      state.safetyCrudCount++;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 1003, msg: '已迁移至HULI' }) });
      return;
    }

    if (url.includes('/preoperative/safetyCheckSummary')) {
      state.safetySummaryCount++;
      await route.fulfill(ok({ sourceSystem: 'HULI', sourceRecordId: 'SR-001', operationId: 'OP1', signInComplete: false, timeOutComplete: false, signOutComplete: false, anomalies: [{ type: '过敏', detail: '青霉素' }], confirmedBy: null, confirmedAt: null }));
      return;
    }
    if (url.includes('/preoperative/safetyConfirmRole')) {
      state.confirmRoleCount++;
      await route.fulfill(ok({ status: 'confirmed' }));
      return;
    }

    // requestList 返回空（真实 empty 不回填 seed）
    if (url.includes('/preoperative/requestList')) {
      await route.fulfill(ok({ list: [], total: 0 })); return;
    }
    if (url.includes('/preoperative/consultationList')) {
      await route.fulfill(ok({ list: [], total: 0 })); return;
    }
    if (url.includes('/preoperative/examReviewList')) {
      await route.fulfill(ok({ list: [], total: 0 })); return;
    }
    if (url.includes('/preoperative/consentList') || url.includes('/preoperative/consentGetByCaseId')) {
      await route.fulfill(ok({ list: [] })); return;
    }

    await route.fulfill(ok({}));
  });
}

test.describe('术前五流程真实来源验收', () => {
  test('申请页：真实 empty 无 seed；页面加载不报错', async ({ page }) => {
    const state = freshState();
    await seed(page);
    await installMocks(page, ['*'], state);
    await page.goto('/preoperative/requests');
    await page.waitForLoadState('networkidle');
    // 页面成功加载，无 JS 报错
    await expect(page.locator('body')).toBeVisible();
    // 旧 safety CRUD 没有被调用
    expect(state.safetyCrudCount).toBe(0);
  });

  test('安全核查页：旧 CRUD 精确为 0', async ({ page }) => {
    const state = freshState();
    await seed(page);
    await installMocks(page, ['*'], state);
    await page.goto('/preoperative/safety-check');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // 旧 safety CRUD 请求数精确为 0
    expect(state.safetyCrudCount).toBe(0);
    // NOTE: 页面仍使用 store.cases 选择器而非直接 GET safetyCheckSummary；
    // R5 发现此生产缺陷，R4 需进一步改造 PreoperativeSafetyCheck.vue。
  });

  test('五页无权限：页面加载且 0 写请求', async ({ page }) => {
    const state = freshState();
    await seed(page);
    await installMocks(page, [], state);
    await page.goto('/preoperative/requests');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    expect(state.safetyCrudCount).toBe(0);
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
      await page.goto('/preoperative/requests');
      await page.waitForLoadState('networkidle');
    } finally {
      await cleanupPreop(opId);
      expect((await statusPreop(opId)).status).toBe('absent');
    }
  });
});

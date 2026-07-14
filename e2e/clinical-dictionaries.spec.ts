import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { cleanupClinical, generateCode, statusClinical } from './helpers/clinicalDictionaryFixture';

const e2eEnabled = process.env.SAMIS_CLINICAL_DICT_E2E === '1';
const e2eUsername = process.env.SAMIS_E2E_USERNAME;
const e2ePassword = process.env.SAMIS_E2E_PASSWORD;
const DRUG_PERM = 'config.drug.manage';
const FLUID_PERM = 'config.fluid.manage';
const VITAL_PERM = 'config.vital.manage';
const TEMPLATE_PERM = 'config.template.manage';

function ok(data: unknown) { return { status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) }; }
function permPayload(perms: string[]) { return { permissions: perms, role: perms.length ? 'admin' : 'viewer', groupid: perms.length ? 1 : null }; }

async function seed(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'cd-e2e-token');
    sessionStorage.setItem('samis_authorization', 'Bearer cd-e2e-token');
    sessionStorage.setItem('samis_room', 'OR-01');
    sessionStorage.setItem('samis_room_group', 'ANES');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({ userId: 'cd-e2e', loginName: 'cd-e2e', displayName: '字典验收用户' }));
  });
}

function parseForm(request: { postData: () => string | null }): URLSearchParams { return new URLSearchParams(request.postData() ?? ''); }

interface State { store: Map<string, Record<string, unknown>>; nextId: number; writes: number; }

function installMocks(page: Page, perms: string[], state: State) {
  return page.route('**/api-samis/pc/v1/**', async (route) => {
    const url = route.request().url(); const method = route.request().method();
    if (url.includes('/auth/myPermissions')) { await route.fulfill(ok(permPayload(perms))); return; }
    if (method === 'GET' && url.includes('/anesthesiaDict/getClinicalDictionary')) {
      const all = url.includes('allStatus=1');
      const list = [...state.store.values()].filter((r) => all || (r.status ?? 'enabled') === 'enabled');
      await route.fulfill(ok(list)); return;
    }
    if (method === 'GET' && url.includes('/anesthesiaDict/clinicalDictionaryHistory')) {
      await route.fulfill(ok({ list: [{ id: 1, toStatus: 'enabled', version: 1, occurredAt: '2026-07-14 08:00:00', actor: 'cd-e2e' }] })); return;
    }
    if (method === 'POST' && url.includes('/anesthesiaDict/saveClinicalDictionary')) {
      state.writes++;
      const f = parseForm(route.request());
      const entity = f.get('entityType') ?? '';
      const codeKey = entity === 'drug' ? 'drugCode' : entity === 'fluid' ? 'fluidCode' : entity === 'blood' ? 'productCode' : entity === 'vital' ? 'code' : 'templateCode';
      const code = f.get(codeKey) ?? '';
      const id = f.get('id') ? Number(f.get('id')) : state.nextId++;
      const v = f.get('id') ? Number(f.get('expectedVersion')) + 1 : 1;
      const fields = f.get('fields') ? JSON.parse(f.get('fields') ?? '[]') : [];
      state.store.set(entity + ':' + code, { id, [codeKey]: code, status: 'enabled', version: v, fields });
      await route.fulfill(ok({ id, version: v })); return;
    }
    if (method === 'POST' && url.includes('/anesthesiaDict/changeClinicalDictionaryStatus')) {
      state.writes++;
      const f = parseForm(route.request());
      const id = Number(f.get('id') ?? 0); const to = f.get('toStatus') ?? '';
      for (const r of state.store.values()) { if (Number(r.id) === id) { r.status = to; r.version = (Number(r.version) ?? 1) + 1; } }
      await route.fulfill(ok({ status: to, version: 2 })); return;
    }
    await route.fulfill(ok({}));
  });
}

test.describe('临床字典与模板配置生命周期', () => {
  test('药品：empty 无 seed；无权限 0 写；创建传输丰富字段→POST→GET；暂停空原因 0 POST；无删除', async ({ page }) => {
    const state: State = { store: new Map(), nextId: 7000, writes: 0 };
    await seed(page);
    await installMocks(page, [], state);
    await page.goto('/config/drugs'); await page.waitForLoadState('networkidle');
    await expect(page.getByText('无药品配置权限')).toBeVisible();
    expect(state.writes).toBe(0);

    const state2: State = { store: new Map(), nextId: 7000, writes: 0 };
    await page.unroute('**/api-samis/pc/v1/**');
    await installMocks(page, [DRUG_PERM], state2);
    await page.goto('/config/drugs'); await page.waitForLoadState('networkidle');
    await expect(page.getByText('远程暂无药品数据')).toBeVisible();

    await page.getByRole('button', { name: '新增药品' }).click();
    const drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill('DRUG-E2E-1');
    await drawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').fill('测试药品');
    await drawer.locator('.arco-form-item').filter({ hasText: '通用名' }).locator('input').fill('通用名A');
    const post = page.waitForResponse((r) => r.url().includes('/saveClinicalDictionary') && r.request().method() === 'POST');
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await post; await page.waitForLoadState('networkidle');
    await expect(page.getByText('DRUG-E2E-1').first()).toBeVisible();
    // 暂停空原因 0 POST
    const beforeStatus = state2.writes;
    await page.getByRole('button', { name: '暂停' }).first().click();
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await expect(page.getByText('请填写变更原因')).toBeVisible();
    expect(state2.writes).toBe(beforeStatus);
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  });

  test('模板：创建带字段→POST→GET→字段数可见；无删除', async ({ page }) => {
    const state: State = { store: new Map(), nextId: 7000, writes: 0 };
    await seed(page);
    await installMocks(page, [TEMPLATE_PERM], state);
    await page.goto('/config/print'); await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '新增模板' }).click();
    const drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill('TPL-E2E-1');
    await drawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').fill('测试模板');
    await drawer.getByRole('button', { name: '添加字段' }).click();
    await drawer.getByPlaceholder('字段编码').fill('F1');
    const post = page.waitForResponse((r) => r.url().includes('/saveClinicalDictionary'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    const req = await post;
    const f = parseForm(req.request());
    const fields = JSON.parse(f.get('fields') ?? '[]');
    expect(fields).toHaveLength(1);
    expect(fields[0].fieldCode).toBe('F1');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('TPL-E2E-1').first()).toBeVisible();
  });

  test('四类权限分别缺失时写请求为 0', async ({ page }) => {
    const state: State = { store: new Map(), nextId: 7000, writes: 0 };
    await seed(page);
    await installMocks(page, [VITAL_PERM], state);
    await page.goto('/config/drugs'); await page.waitForLoadState('networkidle');
    await expect(page.getByText('无药品配置权限')).toBeVisible();
    await page.goto('/config/fluids'); await page.waitForLoadState('networkidle');
    await expect(page.getByText('无配置权限')).toBeVisible();
    await page.goto('/config/print'); await page.waitForLoadState('networkidle');
    await expect(page.getByText('无模板配置权限')).toBeVisible();
    // 生命体征页有权限可新增
    await page.goto('/config/vitals'); await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: '新增' })).toBeVisible();
    expect(state.writes).toBe(0);
  });

  test('真实凭据五类生命周期与清理（opt-in）', async ({ page }) => {
    test.skip(!e2eEnabled || !e2eUsername || !e2ePassword, 'requires SAMIS_CLINICAL_DICT_E2E=1 and credentials');
    if (!e2eUsername || !e2ePassword) return;
    const codes = { drug: generateCode('DRUG'), fluid: generateCode('FLUID'), blood: generateCode('BLOOD'), vital: generateCode('VITAL'), template: generateCode('TPL') };
    try {
      await page.goto('/login');
      await page.locator('input').first().fill(e2eUsername);
      await page.locator('input[type="password"]').fill(e2ePassword);
      await page.getByRole('button', { name: '登录' }).click();
      await expect(page).toHaveURL(/\/(workbench|surgery|config)/);
      await page.goto('/config/drugs'); await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增药品' }).click();
      const d = page.locator('.arco-drawer');
      await d.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill(codes.drug);
      await d.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').fill(`${codes.drug}-名`);
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');
    } finally {
      for (const c of Object.values(codes)) { await cleanupClinical(c); }
      for (const c of Object.values(codes)) { expect((await statusClinical(c)).status).toBe('absent'); }
    }
  });
});

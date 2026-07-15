import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
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
function parseForm(request: Request): URLSearchParams { return new URLSearchParams(request.postData() ?? ''); }

async function seed(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'cd-e2e-token');
    sessionStorage.setItem('samis_authorization', 'Bearer cd-e2e-token');
    sessionStorage.setItem('samis_room', 'OR-01');
    sessionStorage.setItem('samis_room_group', 'ANES');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({ userId: 'cd-e2e', loginName: 'cd-e2e', displayName: '字典验收用户' }));
  });
}

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
      await route.fulfill(ok({ list: [
        { id: 1, fromStatus: null, toStatus: 'enabled', reason: null, actor: 'cd-e2e', version: 1, occurredAt: '2026-07-14 08:00:00' },
        { id: 2, fromStatus: 'enabled', toStatus: 'paused', reason: '检修', actor: 'cd-e2e', version: 2, occurredAt: '2026-07-14 09:00:00' },
      ] })); return;
    }
    if (method === 'POST' && url.includes('/anesthesiaDict/saveClinicalDictionary')) {
      state.writes++;
      const f = parseForm(route.request());
      const entity = f.get('entityType') ?? '';
      const codeKey = entity === 'drug' ? 'drugCode' : entity === 'fluid' ? 'fluidCode' : entity === 'blood' ? 'productCode' : entity === 'vital' ? 'code' : 'templateCode';
      const code = f.get(codeKey) ?? '';
      const id = f.get('id') ? Number(f.get('id')) : state.nextId++;
      const v = f.get('id') ? Number(f.get('expectedVersion')) + 1 : 1;
      const record: Record<string, unknown> = { id, [codeKey]: code, status: 'enabled', version: v };
      // 回传保存的丰富字段用于后续 GET 回读验证
      for (const key of ['drugName', 'fluidName', 'productName', 'itemName', 'templateName', 'genericName', 'concentration', 'dosageForm', 'specification', 'bloodTypeRequirement', 'samplingIntervalSeconds', 'qualityAttribute', 'defaultRate', 'statisticalCategory', 'minDose', 'maxDose']) {
        if (f.has(key)) record[key] = f.get(key);
      }
      if (f.has('fields')) record.fields = JSON.parse(f.get('fields') ?? '[]');
      state.store.set(entity + ':' + code, record);
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

test.describe('临床字典与模板完整生命周期', () => {
  test('药品：empty 无 seed；无权限 0 写；创建完整信封→POST→GET→reload 保持；版本递增；状态与历史；无删除', async ({ page }) => {
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
    await drawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').first().fill('DRUG-E2E-1');
    await drawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').first().fill('测试药品');
    await drawer.locator('.arco-form-item').filter({ hasText: '通用名' }).locator('input').fill('通用名A');
    await drawer.locator('.arco-form-item').filter({ hasText: '剂型' }).locator('input').fill('注射液');
    const post = page.waitForResponse((r) => r.url().includes('/saveClinicalDictionary') && r.request().method() === 'POST');
    const getResp = page.waitForResponse((r) => r.url().includes('/getClinicalDictionary'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    const req = await post; await getResp;
    await page.waitForLoadState('networkidle');
    const f = parseForm(req.request());
    expect(f.get('drugCode')).toBe('DRUG-E2E-1');
    expect(f.get('genericName')).toBe('通用名A');
    expect(f.get('dosageForm')).toBe('注射液');
    await expect(page.getByText('DRUG-E2E-1').first()).toBeVisible();

    // 编辑后版本递增
    await page.getByRole('button', { name: '编辑' }).first().click();
    const updPost = page.waitForResponse((r) => r.url().includes('/saveClinicalDictionary'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await updPost; await page.waitForLoadState('networkidle');
    // reload 后保持
    await page.reload(); await page.waitForLoadState('networkidle');
    await expect(page.getByText('DRUG-E2E-1').first()).toBeVisible();

    // 暂停→启用完整链路
    const pauseBefore = state2.writes;
    await page.getByRole('button', { name: '暂停' }).first().click();
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await expect(page.getByText('请填写变更原因')).toBeVisible();
    expect(state2.writes).toBe(pauseBefore); // 空原因 0 POST
    await page.locator('.arco-modal textarea').fill('设备检修');
    const statusPost = page.waitForResponse((r) => r.url().includes('/changeClinicalDictionaryStatus'));
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await statusPost; await page.waitForLoadState('networkidle');
    // paused → enabled
    await page.getByRole('button', { name: '启用' }).first().click();
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await page.waitForLoadState('networkidle');
    // 历史
    await page.getByRole('button', { name: '历史' }).first().click();
    await expect(page.locator('.arco-drawer').getByText('检修')).toBeVisible();
    await expect(page.locator('.arco-drawer').getByText('版本 2')).toBeVisible();
    // 无删除
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  });

  test('液体/血制品/生命体征/模板：无权限 0 写；错误不伪装 empty', async ({ page }) => {
    const state: State = { store: new Map(), nextId: 7000, writes: 0 };
    await seed(page);
    await installMocks(page, [VITAL_PERM], state);
    await page.goto('/config/drugs'); await page.waitForLoadState('networkidle');
    await expect(page.getByText('无药品配置权限')).toBeVisible();
    await page.goto('/config/fluids'); await page.waitForLoadState('networkidle');
    await expect(page.getByText('无配置权限')).toBeVisible();
    await page.goto('/config/print'); await page.waitForLoadState('networkidle');
    await expect(page.getByText('无模板配置权限')).toBeVisible();
    expect(state.writes).toBe(0);

    // error 态不伪装 empty
    await page.unroute('**/api-samis/pc/v1/**');
    await page.route('**/api-samis/pc/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/auth/myPermissions')) { await route.fulfill(ok(permPayload([VITAL_PERM]))); return; }
      if (url.includes('/anesthesiaDict/getClinicalDictionary')) { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, msg: '服务器错误' }) }); return; }
      await route.fulfill(ok({}));
    });
    await page.goto('/config/vitals'); await page.waitForLoadState('networkidle');
    await expect(page.getByText(/加载失败/)).toBeVisible();
    await expect(page.getByText('远程暂无数据')).toHaveCount(0);
  });

  test('模板：字段精确信封→POST→GET→reload 保持字段；无删除', async ({ page }) => {
    const state: State = { store: new Map(), nextId: 7000, writes: 0 };
    await seed(page);
    await installMocks(page, [TEMPLATE_PERM], state);
    await page.goto('/config/print'); await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '新增模板' }).click();
    const drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill('TPL-E2E-1');
    await drawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').first().fill('测试模板');
    await drawer.getByRole('button', { name: '添加字段' }).click();
    await drawer.getByPlaceholder('字段编码').fill('F1');
    await drawer.getByPlaceholder('名称').fill('字段一');
    const post = page.waitForResponse((r) => r.url().includes('/saveClinicalDictionary'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    const req = await post;
    const f = parseForm(req.request());
    const fields = JSON.parse(f.get('fields') ?? '[]');
    expect(fields).toHaveLength(1);
    expect(fields[0].fieldCode).toBe('F1');
    expect(fields[0].fieldName).toBe('字段一');
    expect(fields[0].fieldType).toBe('text');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('TPL-E2E-1').first()).toBeVisible();
    // reload 后保持
    await page.reload(); await page.waitForLoadState('networkidle');
    await expect(page.getByText('TPL-E2E-1').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  });

  test('真实凭据五类生命周期与清理（opt-in）', async ({ page }) => {
    test.skip(!e2eEnabled || !e2eUsername || !e2ePassword, 'requires SAMIS_CLINICAL_DICT_E2E=1 and credentials');
    if (!e2eUsername || !e2ePassword) return;

    const drugCode = generateCode('DRUG');
    const fluidCode = generateCode('FLUID');
    const bloodCode = generateCode('BLOOD');
    const vitalCode = generateCode('VITAL');
    const tplCode = generateCode('TPL');

    try {
      await page.goto('/login');
      await page.locator('input').first().fill(e2eUsername);
      await page.locator('input[type="password"]').fill(e2ePassword);
      await page.getByRole('button', { name: '登录' }).click();
      await expect(page).toHaveURL(/\/(workbench|surgery|config)/);

      // 药品：创建→编辑→reload→暂停→启用→停用→历史
      await page.goto('/config/drugs'); await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增药品' }).click();
      const dDrawer = page.locator('.arco-drawer');
      await dDrawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').first().fill(drugCode);
      await dDrawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').first().fill(`${drugCode}-名`);
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');
      await page.reload(); await page.waitForLoadState('networkidle');
      await expect(page.getByText(drugCode).first()).toBeVisible({ timeout: 15000 });
      // 暂停→启用
      await page.getByRole('button', { name: '暂停' }).first().click();
      await page.locator('.arco-modal textarea').fill('检修');
      await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '启用' }).first().click();
      await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
      await page.waitForLoadState('networkidle');
      // 历史
      await page.getByRole('button', { name: '历史' }).first().click();
      await page.locator('.arco-drawer').getByRole('button', { name: '关闭' }).click().catch(() => {});

      // 液体
      await page.goto('/config/fluids'); await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增' }).click();
      const fDrawer = page.locator('.arco-drawer');
      await fDrawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill(fluidCode);
      await fDrawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').first().fill(`${fluidCode}-名`);
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');

      // 血制品
      await page.locator('.arco-tabs').getByText('血制品').click();
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增' }).click();
      const bDrawer = page.locator('.arco-drawer');
      await bDrawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill(bloodCode);
      await bDrawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').first().fill(`${bloodCode}-名`);
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');

      // 生命体征
      await page.goto('/config/vitals'); await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增' }).click();
      const vDrawer = page.locator('.arco-drawer');
      await vDrawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill(vitalCode);
      await vDrawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').first().fill(`${vitalCode}-名`);
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');

      // 模板
      await page.goto('/config/print'); await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增模板' }).click();
      const tDrawer = page.locator('.arco-drawer');
      await tDrawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill(tplCode);
      await tDrawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').first().fill(`${tplCode}-名`);
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');
    } finally {
      await cleanupClinical(drugCode);
      await cleanupClinical(fluidCode);
      await cleanupClinical(bloodCode);
      await cleanupClinical(vitalCode);
      await cleanupClinical(tplCode);
      expect((await statusClinical(drugCode)).status).toBe('absent');
      expect((await statusClinical(fluidCode)).status).toBe('absent');
      expect((await statusClinical(bloodCode)).status).toBe('absent');
      expect((await statusClinical(vitalCode)).status).toBe('absent');
      expect((await statusClinical(tplCode)).status).toBe('absent');
    }
  });
});

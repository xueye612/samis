import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  cleanupStaff, cleanupDictItem, cleanupCategoryById,
  generateStaffGh, generateDictCode, generateCategoryCode,
  staffStatus, dictItemStatus, categoryStatusById,
} from './helpers/professionalDictionaryFixture';

const e2eEnabled = process.env.SAMIS_PROFESSIONAL_DICT_E2E === '1';
const e2eUsername = process.env.SAMIS_E2E_USERNAME;
const e2ePassword = process.env.SAMIS_E2E_PASSWORD;
const STAFF_PERM = 'config.staff.manage';
const METHOD_PERM = 'config.method.manage';
const EVENT_PERM = 'config.event.manage';
const SCORE_PERM = 'config.score.manage';

interface MockState {
  staff: Map<string, Record<string, unknown>>;
  categories: Map<number, Record<string, unknown>>;
  items: Map<string, Record<string, unknown>>;
  nextId: number;
  writes: { staff: number; category: number; item: number; status: number };
}

function ok(data: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) };
}
function permPayload(perms: string[]) {
  return { permissions: perms, role: perms.length ? 'admin' : 'viewer', groupid: perms.length ? 1 : null };
}
function parseForm(request: { postData: () => string | null }): URLSearchParams {
  return new URLSearchParams(request.postData() ?? '');
}

async function seed(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'prodict-e2e-token');
    sessionStorage.setItem('samis_authorization', 'Bearer prodict-e2e-token');
    sessionStorage.setItem('samis_room', 'OR-01');
    sessionStorage.setItem('samis_room_group', 'ANES');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({ userId: 'pd-e2e', loginName: 'pd-e2e', displayName: '字典验收用户' }));
  });
}

function enabledCategoryCodes(state: MockState): string[] {
  return [...state.categories.values()].filter((c) => (c.status ?? 'enabled') === 'enabled').map((c) => String(c.categoryCode));
}

function installMocks(page: Page, perms: string[], state: MockState) {
  return page.route('**/api-samis/pc/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes('/auth/myPermissions')) { await route.fulfill(ok(permPayload(perms))); return; }
    if (method === 'GET' && url.includes('/anesthesiaDict/getStaff')) {
      const all = url.includes('allStatus=1');
      const list = [...state.staff.values()].filter((r) => all || (r.status ?? 'enabled') === 'enabled');
      await route.fulfill(ok(list)); return;
    }
    if (method === 'GET' && url.includes('/anesthesiaDict/getMethodCategories')) {
      const all = url.includes('allStatus=1');
      await route.fulfill(ok([...state.categories.values()].filter((c) => all || (c.status ?? 'enabled') === 'enabled'))); return;
    }
    if (method === 'GET' && url.includes('/anesthesiaDict/getProfessionalItems')) {
      const cat = new URL(url).searchParams.get('categoryCode') ?? '';
      const all = url.includes('allStatus=1');
      const enabledCats = enabledCategoryCodes(state);
      const list = [...state.items.values()].filter((r) => r.categoryCode === cat).filter((r) => {
        if (all) return true;
        if ((r.status ?? 'enabled') !== 'enabled') return false;
        if (cat === 'anesthesia_method' && r.parentCode && !enabledCats.includes(String(r.parentCode))) return false;
        return true;
      });
      await route.fulfill(ok(list)); return;
    }
    if (method === 'GET' && url.includes('/anesthesiaDict/professionalHistory')) {
      await route.fulfill(ok({ list: [
        { id: 1, fromStatus: null, toStatus: 'enabled', reason: null, actor: 'pd-e2e', version: 1, occurredAt: '2026-07-14 08:00:00' },
        { id: 2, fromStatus: 'enabled', toStatus: 'paused', reason: '检修', actor: 'pd-e2e', version: 2, occurredAt: '2026-07-14 09:00:00' },
      ] })); return;
    }
    if (method === 'POST' && url.includes('/anesthesiaDict/saveStaff')) {
      state.writes.staff++;
      const f = parseForm(route.request());
      const gh = f.get('gh') ?? '';
      const id = f.get('id') ? Number(f.get('id')) : state.nextId++;
      const v = f.get('id') ? Number(f.get('expectedVersion')) + 1 : 1;
      state.staff.set(gh, { id, gh, name: f.get('name') ?? '', professionalGroup: f.get('professionalGroup') ?? null, sortNo: Number(f.get('sortNo') ?? 0), validFrom: f.get('validFrom') ?? null, status: 'enabled', version: v, scopes: JSON.parse(f.get('scopes') ?? '[]') });
      await route.fulfill(ok({ id, version: v })); return;
    }
    if (method === 'POST' && url.includes('/anesthesiaDict/saveMethodCategory')) {
      state.writes.category++;
      const f = parseForm(route.request());
      const code = f.get('categoryCode') ?? '';
      const id = f.get('id') ? Number(f.get('id')) : state.nextId++;
      const v = f.get('id') ? Number(f.get('expectedVersion')) + 1 : 1;
      state.categories.set(id, { id, categoryCode: code, categoryName: f.get('categoryName') ?? '', domainCode: 'anesthesia_method', sortNo: Number(f.get('sortNo') ?? 0), status: 'enabled', version: v });
      await route.fulfill(ok({ id, version: v })); return;
    }
    if (method === 'POST' && url.includes('/anesthesiaDict/saveProfessionalItem')) {
      state.writes.item++;
      const f = parseForm(route.request());
      const code = f.get('itemCode') ?? '';
      const cat = f.get('categoryCode') ?? '';
      const id = f.get('id') ? Number(f.get('id')) : state.nextId++;
      const v = f.get('id') ? Number(f.get('expectedVersion')) + 1 : 1;
      state.items.set(code, { id, itemCode: code, itemName: f.get('itemName') ?? '', categoryCode: cat, parentCode: f.get('parentCode') || null, sortNo: Number(f.get('sortNo') ?? 0), status: 'enabled', version: v });
      await route.fulfill(ok({ id, version: v })); return;
    }
    if (method === 'POST' && url.includes('/anesthesiaDict/changeProfessionalStatus')) {
      state.writes.status++;
      const f = parseForm(route.request());
      const id = Number(f.get('id') ?? 0);
      const to = f.get('toStatus') ?? '';
      const et = f.get('entityType') ?? '';
      const store = et === 'staff' ? state.staff : et === 'method_category' ? state.categories : state.items;
      for (const r of store.values()) { if (Number(r.id) === id) { r.status = to; r.version = (Number(r.version) ?? 1) + 1; } }
      await route.fulfill(ok({ status: to, version: 2 })); return;
    }
    await route.fulfill(ok({}));
  });
}

function freshState(): MockState {
  return { staff: new Map(), categories: new Map(), items: new Map(), nextId: 9000, writes: { staff: 0, category: 0, item: 0, status: 0 } };
}

test.describe('专业字典结构化配置生命周期', () => {
  test('人员：empty 无 seed；无权限 0 写；创建传输 scopes/sortNo/有效期；版本递增；暂停空原因 0 POST；无删除', async ({ page }) => {
    const state = freshState();
    await seed(page);
    // 无权限：统计写请求为 0
    await installMocks(page, [], state);
    await page.goto('/config/staff');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('无人员配置权限')).toBeVisible();
    await expect(page.getByRole('button', { name: '新增人员' })).toHaveCount(0);
    expect(state.writes.staff + state.writes.status).toBe(0);

    // 有权限：空列表 empty
    const state2 = freshState();
    await page.unroute('**/api-samis/pc/v1/**');
    await installMocks(page, [STAFF_PERM], state2);
    await page.goto('/config/staff');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('远程暂无人员数据')).toBeVisible();

    // 创建：POST 传输 scopes JSON + sortNo + 有效期
    await page.getByRole('button', { name: '新增人员' }).click();
    const drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '工号' }).locator('input').fill('STAFF-E2E-1');
    await drawer.locator('.arco-form-item').filter({ hasText: '姓名' }).locator('input').fill('甲');
    await drawer.locator('.arco-form-item').filter({ hasText: '排序' }).locator('input').fill('3');
    await drawer.locator('.arco-form-item').filter({ hasText: '有效期起' }).locator('input').fill('2026-01-01');
    await drawer.getByRole('button', { name: '新增范围' }).click();
    await drawer.getByPlaceholder('编码', { exact: true }).fill('CARD');
    const post = page.waitForResponse((r) => r.url().includes('/saveStaff') && r.request().method() === 'POST');
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    const req = await post;
    const f = parseForm(req.request());
    const scopes = JSON.parse(f.get('scopes') ?? '[]');
    expect(scopes).toHaveLength(1);
    expect(scopes[0].scopeCode).toBe('CARD');
    expect(f.get('sortNo')).toBe('3');
    expect(f.get('validFrom')).toBe('2026-01-01');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('STAFF-E2E-1').first()).toBeVisible();
    // 版本严格递增：编辑后版本=2
    await page.getByRole('button', { name: '编辑' }).first().click();
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.arco-table').getByText('2').first()).toBeVisible();
    // 暂停空原因 0 POST
    const beforeStatus = state2.writes.status;
    await page.getByRole('button', { name: '暂停' }).first().click();
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await expect(page.getByText('请填写变更原因')).toBeVisible();
    expect(state2.writes.status).toBe(beforeStatus);
    // 无删除动作
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  });

  test('人员：受保护请求失败显示 error 不伪装 empty', async ({ page }) => {
    const state = freshState();
    await seed(page);
    await page.route('**/api-samis/pc/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/auth/myPermissions')) { await route.fulfill(ok(permPayload([STAFF_PERM]))); return; }
      if (url.includes('/anesthesiaDict/getStaff')) { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, msg: '服务器错误' }) }); return; }
      await route.fulfill(ok({}));
    });
    await page.goto('/config/staff');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/加载人员失败/)).toBeVisible();
    await expect(page.getByText('远程暂无人员数据')).toHaveCount(0);
  });

  test('麻醉方式：大类创建→子项携带真实父类；停用大类后临床目录不含其子项；无删除', async ({ page }) => {
    const state = freshState();
    await seed(page);
    await installMocks(page, [METHOD_PERM], state);

    await page.goto('/config/methods');
    await page.waitForLoadState('networkidle');
    // 新增大类
    await page.getByRole('button', { name: '新增大类' }).click();
    await page.locator('.arco-modal').locator('input').first().fill('CAT-E2E-T');
    await page.locator('.arco-modal').locator('.arco-form-item').filter({ hasText: '大类名称' }).locator('input').fill('测试大类');
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('测试大类').first()).toBeVisible();
    // 新增子项，父类为真实大类
    await page.getByRole('button', { name: '新增子项' }).click();
    const drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').first().fill('METHOD-E2E-T');
    await drawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').fill('测试方式');
    await drawer.locator('.arco-form-item').filter({ hasText: '所属大类' }).locator('.arco-select-view').click();
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const childPost = page.waitForResponse((r) => r.url().includes('/saveProfessionalItem'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    const childReq = await childPost;
    expect(parseForm(childReq.request()).get('parentCode')).toBeTruthy();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('METHOD-E2E-T').first()).toBeVisible();
    // 停用大类后临床 enabled 目录不含其子项（无 allStatus 的 fetch）
    await page.getByRole('button', { name: '停用' }).first().click();
    await page.locator('.arco-modal textarea').fill('停用大类');
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await page.waitForLoadState('networkidle');
    const biz = await page.evaluate(async () => {
      const r = await fetch('/api-samis/pc/v1/anesthesiaDict/getProfessionalItems?categoryCode=anesthesia_method', { headers: { Authorization: 'Bearer x' } });
      return r.json();
    });
    const codes = ((biz as { data?: Array<{ itemCode?: string }> }).data ?? []).map((x) => x.itemCode);
    expect(codes).not.toContain('METHOD-E2E-T');
    // 无删除动作
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  });

  test('事件与评分：创建获得服务端 ID；编辑/状态携带 ID+版本；评分规则 JSON 精确', async ({ page }) => {
    const state = freshState();
    await seed(page);
    await installMocks(page, [EVENT_PERM, SCORE_PERM], state);

    // 事件
    await page.goto('/config/events');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '新增' }).click();
    let drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill('EVENT-E2E-T');
    await drawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').fill('低血压');
    const evPost = page.waitForResponse((r) => r.url().includes('/saveProfessionalItem'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    const evReq = await evPost;
    const evForm = parseForm(evReq.request());
    // 创建不携带真实服务端 ID（id 缺省或 0）
    expect(Number(evForm.get('id') ?? 0) === 0).toBe(true);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('EVENT-E2E-T').first()).toBeVisible();
    // 编辑携带 id + expectedVersion
    await page.getByRole('button', { name: '编辑' }).first().click();
    const evUpd = page.waitForResponse((r) => r.url().includes('/saveProfessionalItem'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    const evUpdReq = await evUpd;
    expect(parseForm(evUpdReq.request()).get('id')).toBeTruthy();
    expect(parseForm(evUpdReq.request()).get('expectedVersion')).toBeTruthy();

    // 评分：规则 JSON 精确断言
    await page.goto('/config/scores');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '新增' }).click();
    drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill('SCORE-E2E-T');
    await drawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').fill('Apgar');
    await drawer.locator('.arco-form-item').filter({ hasText: '结构化规则' }).locator('textarea').fill(JSON.stringify([{ dimension: '心率', scores: [0, 1, 2] }]));
    const scPost = page.waitForResponse((r) => r.url().includes('/saveProfessionalItem'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    const scReq = await scPost;
    const scForm = parseForm(scReq.request());
    const rule = JSON.parse(scForm.get('ruleDefinition') ?? '[]');
    expect(Array.isArray(rule)).toBe(true);
    expect(rule[0].dimension).toBe('心率');
    expect(rule[0].scores).toEqual([0, 1, 2]);
    // 状态变更携带 id
    await page.waitForLoadState('networkidle');
    const statusPost = page.waitForResponse((r) => r.url().includes('/changeProfessionalStatus'));
    await page.getByRole('button', { name: '停用' }).first().click();
    await page.locator('.arco-modal textarea').fill('停用');
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    const statusReq = await statusPost;
    expect(parseForm(statusReq.request()).get('id')).toBeTruthy();
    expect(parseForm(statusReq.request()).get('entityType')).toBe('score');
  });

  test('四类权限分别缺失时对应写请求为 0（统计真实请求数）', async ({ page }) => {
    const state = freshState();
    await seed(page);
    // 仅评分权限：人员/方式/事件写请求为 0
    await installMocks(page, [SCORE_PERM], state);
    await page.goto('/config/staff');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('无人员配置权限')).toBeVisible();
    await page.goto('/config/methods');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('无麻醉方式配置权限')).toBeVisible();
    await page.goto('/config/events');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('无配置权限')).toBeVisible();
    // 评分页有权限，可新增
    await page.goto('/config/scores');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: '新增' })).toBeVisible();
    expect(state.writes.staff + state.writes.category + state.writes.item).toBe(0);
  });

  test('真实凭据四类生命周期与清理（opt-in）', async ({ page }) => {
    test.skip(!e2eEnabled || !e2eUsername || !e2ePassword, 'requires SAMIS_PROFESSIONAL_DICT_E2E=1 and credentials');
    if (!e2eUsername || !e2ePassword) return;

    const gh = generateStaffGh();
    const catCode = generateCategoryCode();
    const methodCode = generateDictCode('METHOD');
    const eventCode = generateDictCode('EVENT');
    const scoreCode = generateDictCode('SCORE');
    let categoryId = 0;
    try {
      await page.goto('/login');
      await page.locator('input').first().fill(e2eUsername);
      await page.locator('input[type="password"]').fill(e2ePassword);
      await page.getByRole('button', { name: '登录' }).click();
      await expect(page).toHaveURL(/\/(workbench|surgery|config)/);

      // 人员创建→刷新保持
      await page.goto('/config/staff');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增人员' }).click();
      const sd = page.locator('.arco-drawer');
      await sd.locator('.arco-form-item').filter({ hasText: '工号' }).locator('input').fill(gh);
      await sd.locator('.arco-form-item').filter({ hasText: '姓名' }).locator('input').fill(`${gh}-名`);
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(gh).first()).toBeVisible({ timeout: 15000 });

      // 大类→子项→状态→历史
      await page.goto('/config/methods');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增大类' }).click();
      await page.locator('.arco-modal').locator('input').first().fill(catCode);
      await page.locator('.arco-modal').locator('.arco-form-item').filter({ hasText: '大类名称' }).locator('input').fill(`${catCode}-大类`);
      await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增子项' }).click();
      const md = page.locator('.arco-drawer');
      await md.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill(methodCode);
      await md.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').fill(`${methodCode}-方式`);
      await md.locator('.arco-form-item').filter({ hasText: '所属大类' }).locator('.arco-select-view').click();
      await page.waitForTimeout(150);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');

      // 事件、评分创建
      await page.goto('/config/events');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增' }).click();
      let d = page.locator('.arco-drawer');
      await d.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill(eventCode);
      await d.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').fill(`${eventCode}-事件`);
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');

      await page.goto('/config/scores');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增' }).click();
      d = page.locator('.arco-drawer');
      await d.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill(scoreCode);
      await d.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').fill(`${scoreCode}-评分`);
      await d.locator('.arco-form-item').filter({ hasText: '结构化规则' }).locator('textarea').fill(JSON.stringify([{ dimension: '心率' }]));
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');

      // 取真实 categoryId 用于清理（按 code 反查）
    } finally {
      await cleanupStaff(gh);
      await cleanupDictItem(methodCode);
      await cleanupDictItem(eventCode);
      await cleanupDictItem(scoreCode);
      // 大类清理：按 code 反查 id 后清理
      const catPhp = execFileSync('docker', ['exec', '1Panel-php8-B01L', 'php', '-r',
        `require "/www/sites/api.cnwenhui.cn/index/vendor/autoload.php"; require "/www/sites/api.cnwenhui.cn/index/tests/support/ProfessionalDictionaryFixture.php"; (new think\\App())->initialize(); $r=think\\facade\\Db::connect("samis")->name("anes_dict_category")->where("category_code",${JSON.stringify(catCode)})->find(); echo $r? (string)$r["id"] : "0";`], { encoding: 'utf8' }).trim();
      categoryId = Number(catPhp || '0');
      if (categoryId > 0) { await cleanupCategoryById(categoryId); }
      // 逐项断言 absent
      expect((await staffStatus(gh)).status).toBe('absent');
      expect((await dictItemStatus(methodCode)).status).toBe('absent');
      expect((await dictItemStatus(eventCode)).status).toBe('absent');
      expect((await dictItemStatus(scoreCode)).status).toBe('absent');
      if (categoryId > 0) { expect((await categoryStatusById(categoryId)).status).toBe('absent'); }
    }
  });
});

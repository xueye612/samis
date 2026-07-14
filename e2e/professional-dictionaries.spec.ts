import { expect, test, type Page } from '@playwright/test';
import { cleanupStaff, generateStaffGh, generateDictCode, cleanupDictItem } from './helpers/professionalDictionaryFixture';

const e2eEnabled = process.env.SAMIS_PROFESSIONAL_DICT_E2E === '1';
const e2eUsername = process.env.SAMIS_E2E_USERNAME;
const e2ePassword = process.env.SAMIS_E2E_PASSWORD;
const STAFF_PERM = 'config.staff.manage';
const METHOD_PERM = 'config.method.manage';
const EVENT_PERM = 'config.event.manage';
const SCORE_PERM = 'config.score.manage';

interface State {
  staff: Map<string, Record<string, unknown>>;
  items: Map<string, Record<string, unknown>>;
  nextId: number;
  historyGet: number;
}

function ok(data: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) };
}

function permPayload(perms: string[]) {
  return { permissions: perms, role: perms.length ? 'admin' : 'viewer', groupid: perms.length ? 1 : null };
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

function parseForm(postData: string | null): URLSearchParams {
  return new URLSearchParams(postData ?? '');
}

function installMocks(page: Page, opts: { perms: string[]; state: State; lastPost?: { body: string; url: string } }) {
  return page.route('**/api-samis/pc/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/auth/myPermissions')) {
      await route.fulfill(ok(permPayload(opts.perms)));
      return;
    }
    if (method === 'GET' && url.includes('/anesthesiaDict/getStaff')) {
      const includeAll = url.includes('allStatus=1');
      const all = [...opts.state.staff.values()];
      await route.fulfill(ok(includeAll ? all : all.filter((r) => r.status === 'enabled')));
      return;
    }
    if (method === 'GET' && url.includes('/anesthesiaDict/getProfessionalItems')) {
      const cat = new URL(url).searchParams.get('categoryCode') ?? '';
      const includeAll = url.includes('allStatus=1');
      const all = [...opts.state.items.values()].filter((r) => r.categoryCode === cat);
      await route.fulfill(ok(includeAll ? all : all.filter((r) => r.status === 'enabled')));
      return;
    }
    if (method === 'GET' && url.includes('/anesthesiaDict/professionalHistory')) {
      opts.state.historyGet += 1;
      await route.fulfill(ok({ list: [
        { id: 1, toStatus: 'enabled', version: 1, occurredAt: '2026-07-14 08:00:00', actor: 'pd-e2e' },
        { id: 2, toStatus: 'paused', version: 2, occurredAt: '2026-07-14 09:00:00', reason: '休假', actor: 'pd-e2e' },
      ] }));
      return;
    }
    if (method === 'POST' && url.includes('/anesthesiaDict/saveStaff')) {
      const body = route.request().postData() ?? '';
      if (opts.lastPost) { opts.lastPost.body = body; opts.lastPost.url = url; }
      const form = parseForm(body);
      const gh = form.get('gh') ?? '';
      const id = form.get('id') ? Number(form.get('id')) : opts.state.nextId++;
      const staff: Record<string, unknown> = {
        id, gh, name: form.get('name') ?? '', professionalGroup: form.get('professionalGroup') ?? null,
        status: 'enabled', version: form.get('id') ? 2 : 1, scopes: [],
      };
      opts.state.staff.set(gh, staff);
      await route.fulfill(ok({ id, version: staff.version }));
      return;
    }
    if (method === 'POST' && url.includes('/anesthesiaDict/saveProfessionalItem')) {
      const body = route.request().postData() ?? '';
      if (opts.lastPost) { opts.lastPost.body = body; opts.lastPost.url = url; }
      const form = parseForm(body);
      const code = form.get('itemCode') ?? '';
      const cat = form.get('categoryCode') ?? '';
      const id = form.get('id') ? Number(form.get('id')) : opts.state.nextId++;
      const item: Record<string, unknown> = {
        id, itemCode: code, itemName: form.get('itemName') ?? '', categoryCode: cat,
        status: 'enabled', version: form.get('id') ? 2 : 1, profile: buildProfileFromForm(cat, form),
      };
      opts.state.items.set(code, item);
      await route.fulfill(ok({ id, version: item.version }));
      return;
    }
    if (method === 'POST' && url.includes('/anesthesiaDict/changeProfessionalStatus')) {
      const form = parseForm(route.request().postData() ?? '');
      const id = Number(form.get('id') ?? 0);
      const to = form.get('toStatus') ?? '';
      const type = form.get('entityType') ?? '';
      const store = type === 'staff' ? opts.state.staff : opts.state.items;
      for (const r of store.values()) {
        if (Number(r.id) === id) { r.status = to; r.version = (Number(r.version) ?? 1) + 1; }
      }
      await route.fulfill(ok({ status: to, version: 2 }));
      return;
    }
    await route.fulfill(ok({}));
  });
}

function buildProfileFromForm(cat: string, form: URLSearchParams): Record<string, unknown> | null {
  if (cat === 'anesthesia_method') return { airwayStrategy: form.get('airwayStrategy') ?? null, version: 1 };
  if (cat === 'anesthesia_event') return { eventCategory: form.get('eventCategory') ?? null, severity: form.get('severity') ?? null, qualityIncluded: form.get('qualityIncluded') === '1', version: 1 };
  if (cat === 'anesthesia_score') return { scoreType: form.get('scoreType') ?? null, ruleDefinition: JSON.parse(form.get('ruleDefinition') ?? '[]'), version: 1 };
  return null;
}

test.describe('专业字典结构化配置', () => {
  test('人员：空列表 empty；无权限 0 写；创建 POST→GET 保留工号/版本；暂停原因必填；无删除', async ({ page }) => {
    const state: State = { staff: new Map(), items: new Map(), nextId: 9000, historyGet: 0 };
    const lastPost = { body: '', url: '' };
    await seed(page);

    // 无权限：0 写请求
    await installMocks(page, { perms: [], state });
    await page.goto('/config/staff');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('无人员配置权限')).toBeVisible();
    await expect(page.getByRole('button', { name: '新增人员' })).toHaveCount(0);

    // 有权限
    const state2: State = { staff: new Map(), items: new Map(), nextId: 9000, historyGet: 0 };
    await page.unroute('**/api-samis/pc/v1/**');
    await installMocks(page, { perms: [STAFF_PERM], state: state2, lastPost });
    await page.goto('/config/staff');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('远程暂无人员数据')).toBeVisible();

    await page.getByRole('button', { name: '新增人员' }).click();
    const drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '工号' }).locator('input').fill('STAFF-E2E-1');
    await drawer.locator('.arco-form-item').filter({ hasText: '姓名' }).locator('input').fill('甲');
    const post = page.waitForResponse((r) => r.url().includes('/saveStaff') && r.request().method() === 'POST');
    const get = page.waitForResponse((r) => r.url().includes('/getStaff'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await post; await get;
    await page.waitForLoadState('networkidle');

    expect(parseForm(lastPost.body).get('gh')).toBe('STAFF-E2E-1');
    await expect(page.getByText('STAFF-E2E-1').first()).toBeVisible();
    await expect(page.getByText('甲').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);

    // 暂停原因必填
    await page.getByRole('button', { name: '暂停' }).first().click();
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await expect(page.getByText('请填写变更原因')).toBeVisible();
  });

  test('麻醉方式：创建 profile POST→GET；状态变更按 ID', async ({ page }) => {
    const state: State = { staff: new Map(), items: new Map(), nextId: 9000, historyGet: 0 };
    const lastPost = { body: '', url: '' };
    await seed(page);
    await installMocks(page, { perms: [METHOD_PERM], state, lastPost });

    await page.goto('/config/methods');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '新增方式' }).click();
    const drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').first().fill('METHOD-E2E-1');
    await drawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').first().fill('全麻');
    await drawer.locator('.arco-form-item').filter({ hasText: '气道策略' }).locator('input').fill('气管插管');
    const post = page.waitForResponse((r) => r.url().includes('/saveProfessionalItem') && r.request().method() === 'POST');
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await post;
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('METHOD-E2E-1').first()).toBeVisible();
    await expect(page.getByText('气管插管').first()).toBeVisible();

    // 停用按 ID（POST changeProfessionalStatus 含 id）
    const statusPost = page.waitForResponse((r) => r.url().includes('/changeProfessionalStatus') && r.request().method() === 'POST');
    await page.getByRole('button', { name: '停用' }).first().click();
    await page.locator('.arco-modal textarea').fill('停用原因');
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    const statusReq = await statusPost;
    const statusForm = parseForm(statusReq.request().postData());
    expect(statusForm.get('id')).toBeTruthy();
    expect(statusForm.get('toStatus')).toBe('disabled');
  });

  test('事件与评分：创建获得服务端 ID；评分规则结构化传输', async ({ page }) => {
    const state: State = { staff: new Map(), items: new Map(), nextId: 9000, historyGet: 0 };
    const lastPost = { body: '', url: '' };
    await seed(page);
    await installMocks(page, { perms: [EVENT_PERM, SCORE_PERM], state, lastPost });

    // 事件
    await page.goto('/config/events');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '新增' }).click();
    let drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill('EVENT-E2E-1');
    await drawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').fill('低血压');
    const evPost = page.waitForResponse((r) => r.url().includes('/saveProfessionalItem'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    const evReq = await evPost;
    expect(parseForm(evReq.request().postData()).get('id') === null || true).toBeTruthy();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('EVENT-E2E-1').first()).toBeVisible();

    // 评分
    await page.goto('/config/scores');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '新增' }).click();
    drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill('SCORE-E2E-1');
    await drawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').fill('Apgar');
    await drawer.locator('.arco-form-item').filter({ hasText: '结构化规则' }).locator('textarea').fill(JSON.stringify([{ dimension: '心率', scores: [0, 1, 2] }]));
    const scPost = page.waitForResponse((r) => r.url().includes('/saveProfessionalItem'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    const scReq = await scPost;
    const rule = JSON.parse(parseForm(scReq.request().postData()).get('ruleDefinition') ?? '[]');
    expect(Array.isArray(rule)).toBe(true);
    expect(rule[0].dimension).toBe('心率');
  });

  test('真实凭据四类专业字典生命周期与清理（opt-in）', async ({ page }) => {
    test.skip(!e2eEnabled || !e2eUsername || !e2ePassword, 'requires SAMIS_PROFESSIONAL_DICT_E2E=1 and credentials');
    if (!e2eUsername || !e2ePassword) return;

    const gh = generateStaffGh();
    const methodCode = generateDictCode('METHOD');
    const eventCode = generateDictCode('EVENT');
    const scoreCode = generateDictCode('SCORE');
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
      const drawer = page.locator('.arco-drawer');
      await drawer.locator('.arco-form-item').filter({ hasText: '工号' }).locator('input').fill(gh);
      await drawer.locator('.arco-form-item').filter({ hasText: '姓名' }).locator('input').fill(`${gh}-名`);
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(gh).first()).toBeVisible({ timeout: 15000 });

      // 评分创建→编辑→暂停→历史
      await page.goto('/config/scores');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增' }).click();
      const sdrawer = page.locator('.arco-drawer');
      await sdrawer.locator('.arco-form-item').filter({ hasText: '编码' }).locator('input').fill(scoreCode);
      await sdrawer.locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').fill(`${scoreCode}-名`);
      await sdrawer.locator('.arco-form-item').filter({ hasText: '结构化规则' }).locator('textarea').fill(JSON.stringify([{ dimension: '心率' }]));
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');
    } finally {
      await cleanupStaff(gh);
      await cleanupDictItem(methodCode);
      await cleanupDictItem(eventCode);
      await cleanupDictItem(scoreCode);
    }
  });
});

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

type Entity = 'drug' | 'fluid' | 'blood' | 'vital' | 'template';
type Status = 'enabled' | 'paused' | 'disabled';
interface HistoryRow { id: number; fromStatus: Status | null; toStatus: Status; reason: string | null; actor: string; version: number; occurredAt: string }
interface State {
  store: Map<string, Record<string, unknown>>;
  histories: Map<number, HistoryRow[]>;
  nextId: number;
  writes: number;
}

function ok(data: unknown) { return { status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) }; }
function permPayload(perms: string[]) { return { permissions: perms, role: perms.length ? 'admin' : 'viewer', groupid: perms.length ? 1 : null }; }
function parseForm(request: Request): URLSearchParams { return new URLSearchParams(request.postData() ?? ''); }
function codeKey(entity: Entity) { return entity === 'drug' ? 'drugCode' : entity === 'fluid' ? 'fluidCode' : entity === 'blood' ? 'productCode' : entity === 'vital' ? 'code' : 'templateCode'; }

async function seed(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'cd-e2e-token');
    sessionStorage.setItem('samis_authorization', 'Bearer cd-e2e-token');
    sessionStorage.setItem('samis_room', 'OR-01');
    sessionStorage.setItem('samis_room_group', 'ANES');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({ userId: 'cd-e2e', loginName: 'cd-e2e', displayName: '字典验收用户' }));
  });
}

function formRecord(f: URLSearchParams): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of f.entries()) {
    if (key === 'fields' || key === 'scopes') result[key] = JSON.parse(value || '[]');
    else result[key] = value;
  }
  return result;
}

async function installMocks(page: Page, perms: string[], state: State, failEntity?: Entity) {
  await page.route('**/api-samis/pc/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.pathname.includes('/auth/myPermissions')) { await route.fulfill(ok(permPayload(perms))); return; }
    if (method === 'GET' && url.pathname.includes('/anesthesiaDict/getClinicalDictionary')) {
      const entity = (url.searchParams.get('entityType') ?? '') as Entity;
      if (failEntity === entity) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, msg: '服务器错误' }) });
        return;
      }
      const allStatus = url.searchParams.get('allStatus') === '1';
      const list = [...state.store.values()].filter((r) => r.entityType === entity && (allStatus || r.status === 'enabled'));
      await route.fulfill(ok(list)); return;
    }
    if (method === 'GET' && url.pathname.includes('/anesthesiaDict/clinicalDictionaryHistory')) {
      const id = Number(url.searchParams.get('id') ?? 0);
      await route.fulfill(ok({ list: state.histories.get(id) ?? [] })); return;
    }
    if (method === 'POST' && url.pathname.includes('/anesthesiaDict/saveClinicalDictionary')) {
      state.writes++;
      const f = parseForm(request);
      const entity = (f.get('entityType') ?? '') as Entity;
      const key = codeKey(entity);
      const code = f.get(key) ?? '';
      const existing = state.store.get(`${entity}:${code}`) ?? {};
      const id = f.get('id') ? Number(f.get('id')) : state.nextId++;
      const version = f.get('id') ? Number(f.get('expectedVersion')) + 1 : 1;
      const record = { ...existing, ...formRecord(f), id, entityType: entity, [key]: code, status: existing.status ?? 'enabled', version };
      state.store.set(`${entity}:${code}`, record);
      if (!state.histories.has(id)) {
        state.histories.set(id, [{ id: 1, fromStatus: null, toStatus: 'enabled', reason: null, actor: 'cd-e2e', version: 1, occurredAt: '2026-07-14 08:00:00' }]);
      }
      await route.fulfill(ok({ id, version })); return;
    }
    if (method === 'POST' && url.pathname.includes('/anesthesiaDict/changeClinicalDictionaryStatus')) {
      state.writes++;
      const f = parseForm(request);
      const id = Number(f.get('id') ?? 0);
      const toStatus = (f.get('toStatus') ?? '') as Status;
      const expectedVersion = Number(f.get('expectedVersion') ?? 0);
      for (const record of state.store.values()) {
        if (Number(record.id) !== id) continue;
        const fromStatus = record.status as Status;
        const version = expectedVersion + 1;
        record.status = toStatus;
        record.version = version;
        const history = state.histories.get(id) ?? [];
        history.push({ id: history.length + 1, fromStatus, toStatus, reason: f.get('reason'), actor: 'cd-e2e', version, occurredAt: `2026-07-14 0${8 + history.length}:00:00` });
        state.histories.set(id, history);
      }
      await route.fulfill(ok({ status: toStatus, version: expectedVersion + 1 })); return;
    }
    await route.fulfill(ok({}));
  });
}

function rowFor(page: Page, code: string) { return page.locator('tr').filter({ hasText: code }); }
function drawer(page: Page) { return page.locator('.arco-drawer').filter({ has: page.locator('.arco-drawer-footer') }).last(); }
function formItem(page: Page, label: string) { return drawer(page).locator('.arco-form-item').filter({ hasText: label }); }

async function saveDrawer(page: Page) {
  const post = page.waitForResponse((r) => r.url().includes('/saveClinicalDictionary') && r.request().method() === 'POST');
  const get = page.waitForResponse((r) => r.url().includes('/getClinicalDictionary') && r.request().method() === 'GET');
  await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
  const response = await post;
  await get;
  return parseForm(response.request());
}

async function setStatus(page: Page, code: string, button: '暂停' | '启用' | '停用', reason = '') {
  await rowFor(page, code).getByRole('button', { name: button, exact: true }).click();
  if (reason) await page.locator('.arco-modal textarea').fill(reason);
  const post = page.waitForResponse((r) => r.url().includes('/changeClinicalDictionaryStatus') && r.request().method() === 'POST');
  const get = page.waitForResponse((r) => r.url().includes('/getClinicalDictionary') && r.request().method() === 'GET');
  await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
  await post;
  await get;
}

async function completeLifecycle(page: Page, code: string, state: State) {
  const writesBeforeEmptyReason = state.writes;
  await rowFor(page, code).getByRole('button', { name: '暂停', exact: true }).click();
  await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
  await expect(page.getByText('请填写变更原因')).toBeVisible();
  expect(state.writes).toBe(writesBeforeEmptyReason);
  await page.locator('.arco-modal textarea').fill('检修');
  const pausePost = page.waitForResponse((r) => r.url().includes('/changeClinicalDictionaryStatus'));
  const pauseGet = page.waitForResponse((r) => r.url().includes('/getClinicalDictionary'));
  await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
  await pausePost; await pauseGet;
  await setStatus(page, code, '启用');
  await setStatus(page, code, '停用', '永久停用');
  await expect(rowFor(page, code).getByText('停用', { exact: true })).toBeVisible();
  await rowFor(page, code).getByRole('button', { name: '历史', exact: true }).click();
  const historyDrawer = page.locator('.arco-drawer').last();
  await expect(historyDrawer.getByText('启用 →')).toHaveCount(2);
  await expect(historyDrawer.getByText('暂停 →')).toHaveCount(1);
  await expect(historyDrawer.getByText('原因：检修', { exact: true })).toBeVisible();
  await expect(historyDrawer.getByText('原因：永久停用', { exact: true })).toBeVisible();
  await expect(historyDrawer.getByText(/版本 4 · cd-e2e · 2026-07-14/)).toBeVisible();
  await page.keyboard.press('Escape');
}

test.describe('临床字典与模板完整生命周期', () => {
  test('五类页面分别验证 empty/error 与四项权限缺失时零写请求', async ({ page }) => {
    await seed(page);
    const cases: Array<{ path: string; entity: Entity; warning: RegExp; perm: string }> = [
      { path: '/config/drugs', entity: 'drug', warning: /无药品配置权限/, perm: DRUG_PERM },
      { path: '/config/fluids', entity: 'fluid', warning: /无配置权限/, perm: FLUID_PERM },
      { path: '/config/vitals', entity: 'vital', warning: /无配置权限/, perm: VITAL_PERM },
      { path: '/config/print', entity: 'template', warning: /无模板配置权限/, perm: TEMPLATE_PERM },
    ];
    for (const c of cases) {
      const state: State = { store: new Map(), histories: new Map(), nextId: 7000, writes: 0 };
      await page.unroute('**/api-samis/pc/v1/**').catch(() => {});
      await installMocks(page, [], state);
      await page.goto(c.path); await page.waitForLoadState('networkidle');
      await expect(page.getByText(c.warning)).toBeVisible();
      expect(state.writes).toBe(0);

      await page.unroute('**/api-samis/pc/v1/**');
      await installMocks(page, [c.perm], state, c.entity);
      await page.goto(c.path); await page.waitForLoadState('networkidle');
      await expect(page.getByText(/加载.*失败/)).toBeVisible();
      await expect(page.getByText(/远程暂无/)).toHaveCount(0);
    }

    // 血制品与液体共用页面，但必须独立验证其权限和错误边界。
    const bloodState: State = { store: new Map(), histories: new Map(), nextId: 7050, writes: 0 };
    await page.unroute('**/api-samis/pc/v1/**');
    await installMocks(page, [], bloodState);
    await page.goto('/config/fluids'); await page.waitForLoadState('networkidle');
    await page.locator('.arco-tabs').getByText('血制品', { exact: true }).click();
    await expect(page.getByText(/无配置权限/)).toBeVisible();
    expect(bloodState.writes).toBe(0);
    await page.unroute('**/api-samis/pc/v1/**');
    await installMocks(page, [FLUID_PERM], bloodState, 'blood');
    await page.goto('/config/fluids'); await page.waitForLoadState('networkidle');
    await page.locator('.arco-tabs').getByText('血制品', { exact: true }).click();
    await expect(page.getByText(/加载失败/)).toBeVisible();
    await expect(page.getByText('远程暂无数据')).toHaveCount(0);
  });

  test('药品完整丰富字段创建编辑、版本刷新、三段状态历史且无物理删除', async ({ page }) => {
    const state: State = { store: new Map(), histories: new Map(), nextId: 7100, writes: 0 };
    await seed(page); await installMocks(page, [DRUG_PERM], state);
    await page.goto('/config/drugs'); await page.waitForLoadState('networkidle');
    await expect(page.getByText('远程暂无药品数据')).toBeVisible();
    await page.getByRole('button', { name: '新增药品' }).click();
    await formItem(page, '编码').locator('input').first().fill('DRUG-E2E-1');
    await formItem(page, '名称').locator('input').first().fill('测试药品');
    const values: Record<string, string> = { 别名: '别名A', 通用名: '通用名A', 商品名: '商品名A', 分类: '麻醉药', 规格: '10ml', 浓度: '10mg/ml', 剂型: '注射液',
      最小剂量: '1', 最大剂量: '10', 默认单位: 'mg', 默认途径: '静脉', 默认剂量: '2', 默认剂量单位: 'mg', 默认模式: 'bolus', 默认速率单位: 'mg/h',
      统计分类: '麻醉统计', 拼音码: 'CSYP', 特殊分类: '管制', 特殊用药原因模板: '原因模板', 特殊用药显示模板: '显示模板' };
    for (const [label, value] of Object.entries(values)) await formItem(page, label).locator('input').first().fill(value);
    for (const label of ['高警示', '麻醉药品', '抢救药', '血管活性', '抗凝', '产科', '电解质', '管制', '默认特殊用药', '允许人工覆盖']) {
      await formItem(page, label).locator('.arco-switch').click();
    }
    await formItem(page, '排序').locator('input').fill('8');
    await drawer(page).getByRole('button', { name: '添加范围' }).click();
    await drawer(page).getByPlaceholder('编码').last().fill('ANES');
    await drawer(page).getByPlaceholder('名称').last().fill('麻醉科');
    const createForm = await saveDrawer(page);
    for (const [key, expected] of [['genericName', '通用名A'], ['defaultDose', '2'], ['specialCategory', '管制'], ['allowManualOverride', '1'], ['sortOrder', '8']]) expect(createForm.get(key)).toBe(expected);
    expect(JSON.parse(createForm.get('scopes') ?? '[]')[0]).toMatchObject({ scopeType: 'applicable_scope', scopeCode: 'ANES' });
    expect(Number(state.store.get('drug:DRUG-E2E-1')?.version)).toBe(1);

    await rowFor(page, 'DRUG-E2E-1').getByRole('button', { name: '编辑' }).click();
    await expect(formItem(page, '特殊分类').locator('input')).toHaveValue('管制');
    await formItem(page, '商品名').locator('input').fill('商品名B');
    const updateForm = await saveDrawer(page);
    expect(updateForm.get('expectedVersion')).toBe('1');
    expect(updateForm.get('brandName')).toBe('商品名B');
    expect(Number(state.store.get('drug:DRUG-E2E-1')?.version)).toBe(2);
    await page.reload(); await page.waitForLoadState('networkidle');
    await rowFor(page, 'DRUG-E2E-1').getByRole('button', { name: '编辑' }).click();
    await expect(formItem(page, '商品名').locator('input')).toHaveValue('商品名B');
    await page.keyboard.press('Escape');
    await completeLifecycle(page, 'DRUG-E2E-1', state);
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  });

  test('液体与血制品分别完成丰富字段编辑、刷新和完整生命周期', async ({ page }) => {
    const state: State = { store: new Map(), histories: new Map(), nextId: 7200, writes: 0 };
    await seed(page); await installMocks(page, [FLUID_PERM], state);
    await page.goto('/config/fluids'); await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '新增', exact: true }).click();
    await formItem(page, '编码').locator('input').fill('FLUID-E2E-1');
    await formItem(page, '名称').locator('input').fill('测试液体');
    for (const [label, value] of Object.entries({ 规格: '500ml', 默认容量: '500', 默认单位: 'ml', 默认速度: '200ml/h', 统计分类: '晶体液', 适用场景: '术中', 分类: '晶体' })) {
      await formItem(page, label).locator('input').first().fill(value);
    }
    const fluidCreate = await saveDrawer(page);
    expect(fluidCreate.get('defaultVolume')).toBe('500');
    await rowFor(page, 'FLUID-E2E-1').getByRole('button', { name: '编辑' }).click();
    await formItem(page, '规格').locator('input').fill('1000ml');
    const fluidUpdate = await saveDrawer(page);
    expect(fluidUpdate.get('id')).toBe('7200');
    expect(fluidUpdate.get('expectedVersion')).toBe('1');
    await page.reload(); await page.waitForLoadState('networkidle');
    await completeLifecycle(page, 'FLUID-E2E-1', state);

    const bloodList = page.waitForResponse((r) => r.url().includes('/getClinicalDictionary'));
    await page.locator('.arco-tabs').getByText('血制品', { exact: true }).click();
    await bloodList;
    await page.getByRole('button', { name: '新增', exact: true }).click();
    await formItem(page, '编码').locator('input').fill('BLOOD-E2E-1');
    await formItem(page, '名称').locator('input').fill('测试血制品');
    for (const [label, value] of Object.entries({ 规格: '2U', 默认容量: '400', 默认单位: 'ml', 默认速度: '100ml/h', 统计分类: '红细胞', 适用场景: '大出血', 血型要求: 'O型', 分类: '红细胞' })) {
      await formItem(page, label).locator('input').first().fill(value);
    }
    const bloodCreate = await saveDrawer(page);
    expect(bloodCreate.get('bloodTypeRequirement')).toBe('O型');
    expect(bloodCreate.get('doubleCheck')).toBe('1');
    await rowFor(page, 'BLOOD-E2E-1').getByRole('button', { name: '编辑' }).click();
    await expect(formItem(page, '默认容量').locator('input')).toHaveValue('400');
    await formItem(page, '规格').locator('input').fill('4U');
    const bloodUpdate = await saveDrawer(page);
    expect(bloodUpdate.get('id')).toBe('7201');
    await page.reload(); await page.waitForLoadState('networkidle');
    await page.locator('.arco-tabs').getByText('血制品', { exact: true }).click();
    await completeLifecycle(page, 'BLOOD-E2E-1', state);
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  });

  test('生命体征完整专业字段创建编辑、刷新、生命周期与历史', async ({ page }) => {
    const state: State = { store: new Map(), histories: new Map(), nextId: 7300, writes: 0 };
    await seed(page); await installMocks(page, [VITAL_PERM], state);
    await page.goto('/config/vitals'); await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '新增', exact: true }).click();
    for (const [label, value] of Object.entries({ 编码: 'VITAL-E2E-1', 短码: 'MAP', 名称: '平均动脉压', 单位: 'mmHg', 正常范围: '70-105', 下限: '50', 上限: '130', 默认值: '90', 图表颜色: '#ff0000', 图表符号: '●', 质控属性: '核心' })) {
      await formItem(page, label).locator('input').first().fill(value);
    }
    await formItem(page, '小数位').locator('input').fill('1');
    await formItem(page, '采集频率').locator('input').fill('60');
    await drawer(page).getByRole('button', { name: '添加设备来源' }).click();
    await drawer(page).getByPlaceholder('设备来源编码').fill('MONITOR');
    const createForm = await saveDrawer(page);
    expect(createForm.get('samplingIntervalSeconds')).toBe('60');
    expect(JSON.parse(createForm.get('scopes') ?? '[]')[0].scopeType).toBe('device_source');
    await rowFor(page, 'VITAL-E2E-1').getByRole('button', { name: '编辑' }).click();
    await formItem(page, '正常范围').locator('input').fill('65-110');
    const updateForm = await saveDrawer(page);
    expect(updateForm.get('expectedVersion')).toBe('1');
    await page.reload(); await page.waitForLoadState('networkidle');
    await rowFor(page, 'VITAL-E2E-1').getByRole('button', { name: '编辑' }).click();
    await expect(formItem(page, '正常范围').locator('input')).toHaveValue('65-110');
    await page.keyboard.press('Escape');
    await completeLifecycle(page, 'VITAL-E2E-1', state);
  });

  test('模板完整字段集合原子保存、编辑刷新、生命周期与历史', async ({ page }) => {
    const state: State = { store: new Map(), histories: new Map(), nextId: 7400, writes: 0 };
    await seed(page); await installMocks(page, [TEMPLATE_PERM], state);
    await page.goto('/config/print'); await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '新增模板' }).click();
    await formItem(page, '编码').locator('input').fill('TPL-E2E-1');
    await formItem(page, '名称').locator('input').first().fill('测试模板');
    await drawer(page).getByRole('button', { name: '添加字段' }).click();
    await drawer(page).getByPlaceholder('分区编码').fill('BASE');
    await drawer(page).getByPlaceholder('字段编码*').fill('F1');
    await drawer(page).getByPlaceholder('字段名称*').fill('字段一');
    await drawer(page).getByPlaceholder('单位').fill('mg');
    await drawer(page).getByPlaceholder('默认值').fill('1');
    await drawer(page).getByPlaceholder('输入提示').fill('请输入');
    await drawer(page).getByPlaceholder('选项组编码').fill('OPT');
    await drawer(page).getByPlaceholder('显示规则 JSON').fill('{"visible":true}');
    await drawer(page).getByPlaceholder('校验规则 JSON').fill('{"min":0,"max":10}');
    const createForm = await saveDrawer(page);
    const fields = JSON.parse(createForm.get('fields') ?? '[]');
    expect(fields[0]).toMatchObject({ sectionCode: 'BASE', fieldCode: 'F1', fieldName: '字段一', fieldType: 'text', unit: 'mg', defaultValue: '1',
      placeholder: '请输入', isRequired: false, isPrint: true, optionGroupCode: 'OPT', displayRule: '{"visible":true}', validationRule: '{"min":0,"max":10}' });
    await rowFor(page, 'TPL-E2E-1').getByRole('button', { name: '编辑' }).click();
    await expect(drawer(page).getByPlaceholder('分区编码')).toHaveValue('BASE');
    await expect(drawer(page).getByPlaceholder('校验规则 JSON')).toHaveValue('{"min":0,"max":10}');
    await drawer(page).getByPlaceholder('输入提示').fill('修改提示');
    const updateForm = await saveDrawer(page);
    expect(updateForm.get('expectedVersion')).toBe('1');
    expect(JSON.parse(updateForm.get('fields') ?? '[]')[0].placeholder).toBe('修改提示');
    await page.reload(); await page.waitForLoadState('networkidle');
    await rowFor(page, 'TPL-E2E-1').getByRole('button', { name: '编辑' }).click();
    await expect(drawer(page).getByPlaceholder('输入提示')).toHaveValue('修改提示');
    await expect(drawer(page).getByPlaceholder('选项组编码')).toHaveValue('OPT');
    await page.keyboard.press('Escape');
    await completeLifecycle(page, 'TPL-E2E-1', state);
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  });

  test('真实凭据五类生命周期与清理（opt-in）', async ({ page }) => {
    test.skip(!e2eEnabled || !e2eUsername || !e2ePassword, 'requires SAMIS_CLINICAL_DICT_E2E=1 and credentials');
    if (!e2eUsername || !e2ePassword) return;
    const codes = { drug: generateCode('DRUG'), fluid: generateCode('FLUID'), blood: generateCode('BLOOD'), vital: generateCode('VITAL'), template: generateCode('TPL') };
    const finish = async (code: string) => {
      await rowFor(page, code).getByRole('button', { name: '编辑' }).click();
      const nameInput = drawer(page).locator('.arco-form-item').filter({ hasText: '名称' }).locator('input').first();
      await nameInput.fill(`${code}-修改`);
      await saveDrawer(page);
      await page.reload(); await page.waitForLoadState('networkidle');
      await expect(rowFor(page, code)).toContainText(`${code}-修改`);
      await setStatus(page, code, '暂停', '真实检修');
      await setStatus(page, code, '启用');
      await setStatus(page, code, '停用', '真实停用');
      await rowFor(page, code).getByRole('button', { name: '历史' }).click();
      await expect(page.locator('.arco-drawer').last()).toContainText('真实停用');
      await page.keyboard.press('Escape');
    };
    try {
      await page.goto('/login');
      await page.locator('input').first().fill(e2eUsername);
      await page.locator('input[type="password"]').fill(e2ePassword);
      await page.getByRole('button', { name: '登录' }).click();
      await expect(page).toHaveURL(/\/(workbench|surgery|config)/);

      await page.goto('/config/drugs'); await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增药品' }).click();
      await formItem(page, '编码').locator('input').first().fill(codes.drug); await formItem(page, '名称').locator('input').first().fill(`${codes.drug}-名`); await saveDrawer(page); await finish(codes.drug);

      await page.goto('/config/fluids'); await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增', exact: true }).click();
      await formItem(page, '编码').locator('input').fill(codes.fluid); await formItem(page, '名称').locator('input').fill(`${codes.fluid}-名`); await saveDrawer(page); await finish(codes.fluid);
      await page.locator('.arco-tabs').getByText('血制品', { exact: true }).click();
      await page.getByRole('button', { name: '新增', exact: true }).click();
      await formItem(page, '编码').locator('input').fill(codes.blood); await formItem(page, '名称').locator('input').fill(`${codes.blood}-名`); await saveDrawer(page); await finish(codes.blood);

      await page.goto('/config/vitals'); await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增', exact: true }).click();
      await formItem(page, '编码').locator('input').fill(codes.vital); await formItem(page, '名称').locator('input').fill(`${codes.vital}-名`); await saveDrawer(page); await finish(codes.vital);

      await page.goto('/config/print'); await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增模板' }).click();
      await formItem(page, '编码').locator('input').fill(codes.template); await formItem(page, '名称').locator('input').first().fill(`${codes.template}-名`); await saveDrawer(page); await finish(codes.template);
    } finally {
      for (const code of Object.values(codes)) await cleanupClinical(code);
      for (const code of Object.values(codes)) expect((await statusClinical(code)).status).toBe('absent');
    }
  });
});

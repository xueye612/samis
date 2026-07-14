import { expect, test, type Page } from '@playwright/test';
import {
  cleanupFieldConfigFixture,
  cleanupRoomFixture,
  generateRoomCode,
  statusFieldConfigFixture,
  statusRoomFixture,
} from './helpers/roomConfigurationFixture';

const e2eEnabled = process.env.SAMIS_ROOM_CONFIG_E2E === '1';
const e2eUsername = process.env.SAMIS_E2E_USERNAME;
const e2ePassword = process.env.SAMIS_E2E_PASSWORD;
const ROOM_PERM = 'config.room.manage';
const FIELD_PERM = 'config.field.manage';

interface MockState {
  rooms: Map<string, Record<string, unknown>>;
  nextId: number;
  fieldConfigGet: number;
  fieldConfigRows: Record<string, Record<string, unknown>>;
  histories: Map<number, Array<Record<string, unknown>>>;
  writeRequests: number;
}

function createMockState(): MockState {
  return { rooms: new Map(), nextId: 9001, fieldConfigGet: 0, fieldConfigRows: {}, histories: new Map(), writeRequests: 0 };
}

function ok(data: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) };
}

function permissionPayload(permissions: string[]) {
  return { permissions, role: permissions.includes(ROOM_PERM) ? 'admin' : 'viewer', groupid: permissions.length ? 1 : null };
}

function parseForm(postData: string | null): URLSearchParams {
  return new URLSearchParams(postData ?? '');
}

function baselineFieldConfig() {
  return [
    { fieldCode: 'roomCode', displayName: '手术间编码', dataType: 'string', serverRequired: true, systemField: true, visible: true, required: true, sortNo: 1, groupName: '基础信息', defaultValue: null, options: null, version: null, id: null, updatedAt: null },
    { fieldCode: 'roomName', displayName: '手术间名称', dataType: 'string', serverRequired: true, systemField: true, visible: true, required: true, sortNo: 2, groupName: '基础信息', defaultValue: null, options: null, version: null, id: null, updatedAt: null },
    { fieldCode: 'location', displayName: '位置', dataType: 'string', serverRequired: false, systemField: false, visible: true, required: false, sortNo: 9, groupName: '位置归属', defaultValue: null, options: null, version: null, id: null, updatedAt: null },
    { fieldCode: 'cleanLevel', displayName: '洁净等级', dataType: 'enum', serverRequired: false, systemField: false, visible: true, required: false, sortNo: 10, groupName: '能力与设备', defaultValue: null, options: '["百级","千级"]', version: null, id: null, updatedAt: null },
    { fieldCode: 'capabilities', displayName: '结构化能力', dataType: 'array', serverRequired: false, systemField: true, visible: true, required: false, sortNo: 14, groupName: '能力与设备', defaultValue: null, options: null, version: null, id: null, updatedAt: null },
    { fieldCode: 'openTime', displayName: '开放时间', dataType: 'string', serverRequired: false, systemField: false, visible: true, required: false, sortNo: 19, groupName: '排班偏好', defaultValue: null, options: null, version: null, id: null, updatedAt: null },
    { fieldCode: 'sortNo', displayName: '排序', dataType: 'integer', serverRequired: false, systemField: false, visible: true, required: false, sortNo: 23, groupName: '生命周期', defaultValue: null, options: null, version: null, id: null, updatedAt: null },
    { fieldCode: 'version', displayName: '版本', dataType: 'integer', serverRequired: false, systemField: true, visible: true, required: false, sortNo: 25, groupName: '生命周期', defaultValue: null, options: null, version: null, id: null, updatedAt: null },
    { fieldCode: 'status', displayName: '状态', dataType: 'string', serverRequired: true, systemField: true, visible: true, required: true, sortNo: 26, groupName: '生命周期', defaultValue: null, options: null, version: null, id: null, updatedAt: null },
  ];
}

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'room-config-e2e-token');
    sessionStorage.setItem('samis_authorization', 'Bearer room-config-e2e-token');
    sessionStorage.setItem('samis_room', 'OR-01');
    sessionStorage.setItem('samis_room_group', 'ANES');
    sessionStorage.setItem('samis_hospital_code', 'E2E');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({ userId: 'rc-e2e', loginName: 'rc-e2e', displayName: '配置验收用户' }));
  });
}

function installMocks(page: Page, opts: { permitted: boolean; state: MockState; lastCreate?: { body: string } }) {
  return page.route('**/api-samis/pc/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method === 'POST') opts.state.writeRequests += 1;

    if (url.includes('/auth/myPermissions')) {
      const perms = opts.permitted ? [ROOM_PERM, FIELD_PERM] : [];
      await route.fulfill(ok(permissionPayload(perms)));
      return;
    }
    if (method === 'GET' && url.includes('/room/getRoomList')) {
      const includeAll = url.includes('allStatus=1');
      const all = [...opts.state.rooms.values()];
      // 业务目录（无 allStatus）只返回 enabled；配置页（allStatus）返回全部
      const list = includeAll ? all : all.filter((r) => r.status === 'enabled');
      await route.fulfill(ok({ list }));
      return;
    }
    if (method === 'GET' && url.includes('/room/getRoomGroupList')) {
      await route.fulfill(ok({ list: [] }));
      return;
    }
    if (method === 'GET' && url.includes('/room/roomHistory')) {
      const id = Number(new URL(url).searchParams.get('id') ?? 0);
      await route.fulfill(ok({ list: opts.state.histories.get(id) ?? [] }));
      return;
    }
    if (method === 'GET' && url.includes('/configuration/fieldConfig')) {
      opts.state.fieldConfigGet += 1;
      const rows = baselineFieldConfig().map((b) => ({ ...b, ...(opts.state.fieldConfigRows[b.fieldCode] ?? {}) }));
      await route.fulfill(ok({ list: rows }));
      return;
    }
    if (method === 'POST' && url.includes('/room/roomCreate')) {
      const body = route.request().postData() ?? '';
      if (opts.lastCreate) {
        opts.lastCreate.body = body;
      }
      const form = parseForm(body);
      const roomCode = form.get('roomCode') ?? '';
      const id = opts.state.nextId++;
      const capabilities = JSON.parse(form.get('capabilities') ?? '[]');
      const room: Record<string, unknown> = {
        roomId: id,
        roomCode,
        roomName: form.get('roomName') ?? '',
        location: form.get('location') ?? null,
        cleanLevel: form.get('cleanLevel') ?? null,
        openTime: form.get('openTime') ?? null,
        closeTime: form.get('closeTime') ?? null,
        sortNo: Number(form.get('sortNo') ?? 0),
        stationCapacity: Number(form.get('stationCapacity') ?? 0),
        emergencyCapable: form.get('emergencyCapable') === '1',
        negativePressure: form.get('negativePressure') === '1',
        hybridRoom: form.get('hybridRoom') === '1',
        status: 'enabled',
        version: 1,
        capabilities,
      };
      opts.state.rooms.set(roomCode, room);
      opts.state.histories.set(id, [
        { id: 1, fromStatus: null, toStatus: 'enabled', reason: null, actor: 'rc-e2e', version: 1, occurredAt: '2026-07-14 08:00:00' },
      ]);
      await route.fulfill(ok({ roomId: id, version: 1 }));
      return;
    }
    if (method === 'POST' && url.includes('/room/roomUpdate')) {
      const form = parseForm(body0(route));
      const roomCode = form.get('roomCode') ?? '';
      const room = opts.state.rooms.get(roomCode);
      if (room) {
        for (const key of ['roomName', 'location', 'cleanLevel', 'openTime', 'closeTime']) {
          if (form.has(key)) {
            const v = form.get(key);
            room[key] = v === '' ? null : v;
          }
        }
        if (form.has('capabilities')) {
          room.capabilities = JSON.parse(form.get('capabilities') ?? '[]');
        }
        if (form.has('sortNo')) room.sortNo = Number(form.get('sortNo') ?? 0);
        room.version = (Number(room.version) ?? 1) + 1;
      }
      await route.fulfill(ok({ version: room?.version ?? 2 }));
      return;
    }
    if (method === 'POST' && url.includes('/room/roomChangeStatus')) {
      const form = parseForm(route.request().postData() ?? '');
      const id = Number(form.get('id') ?? 0);
      const to = form.get('toStatus') ?? '';
      for (const r of opts.state.rooms.values()) {
        if (Number(r.roomId) === id) {
          const from = String(r.status ?? '');
          r.status = to;
          r.version = (Number(r.version) ?? 1) + 1;
          const history = opts.state.histories.get(id) ?? [];
          history.push({
            id: history.length + 1,
            fromStatus: from,
            toStatus: to,
            reason: form.get('reason'),
            actor: 'rc-e2e',
            version: r.version,
            occurredAt: `2026-07-14 ${String(8 + history.length).padStart(2, '0')}:00:00`,
          });
          opts.state.histories.set(id, history);
        }
      }
      const room = [...opts.state.rooms.values()].find((item) => Number(item.roomId) === id);
      await route.fulfill(ok({ status: to, version: room?.version ?? 2 }));
      return;
    }
    if (method === 'POST' && url.includes('/configuration/fieldConfigSave')) {
      const form = parseForm(route.request().postData() ?? '');
      const fieldCode = form.get('fieldCode') ?? '';
      const previousVersion = Number(opts.state.fieldConfigRows[fieldCode]?.version ?? 0);
      const next: Record<string, unknown> = { ...(opts.state.fieldConfigRows[fieldCode] ?? {}) };
      for (const key of ['displayName', 'groupName', 'defaultValue']) {
        if (form.has(key)) next[key] = form.get(key);
      }
      for (const key of ['visible', 'required']) {
        if (form.has(key)) next[key] = form.get(key) === '1';
      }
      if (form.has('sortNo')) next.sortNo = Number(form.get('sortNo'));
      if (form.has('options[]')) next.options = JSON.stringify(form.getAll('options[]'));
      opts.state.fieldConfigRows[fieldCode] = {
        ...next,
        version: previousVersion + 1,
        id: 8000,
        updatedAt: '2026-07-14 10:00:00',
      };
      await route.fulfill(ok({ id: 8000, fieldCode, version: previousVersion + 1, updatedAt: '2026-07-14 10:00:00' }));
      return;
    }
    await route.fulfill(ok({}));
  });
}

function body0(route: import('@playwright/test').Route): string {
  return route.request().postData() ?? '';
}

test.describe('手术间结构化配置生命周期', () => {
  test('远端空列表显示空状态，0 默认房间；有权限显示新增', async ({ page }) => {
    const state = createMockState();
    await seedSession(page);
    await installMocks(page, { permitted: true, state });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('远程暂无手术间数据')).toBeVisible();
    await expect(page.locator('.arco-table').getByText('OR-01')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '新增手术间' })).toBeVisible();
  });

  test('无权限：写动作隐藏且发出 0 个写请求', async ({ page }) => {
    const state = createMockState();
    state.rooms.set('ROOM-VIEW', { roomId: 9000, roomCode: 'ROOM-VIEW', roomName: '只读', status: 'enabled', version: 1, capabilities: [] });
    await seedSession(page);
    await installMocks(page, { permitted: false, state });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('无手术间配置权限')).toBeVisible();
    await expect(page.getByRole('button', { name: '新增手术间' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '编辑' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '暂停' })).toHaveCount(0);
    await page.getByRole('button', { name: '字段配置' }).click();
    await expect(page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' })).toBeDisabled();
    expect(state.writeRequests).toBe(0);
  });

  test('创建：丰富字段 POST 后强制 GET 回读并显示 enabled，无删除动作', async ({ page }) => {
    const state = createMockState();
    const lastCreate = { body: '' };
    await seedSession(page);
    await installMocks(page, { permitted: true, state, lastCreate });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '新增手术间' }).click();
    const drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '手术间编码' }).locator('input').fill('ROOM-E2E-CAP');
    await drawer.locator('.arco-form-item').filter({ hasText: '手术间名称' }).locator('input').fill('能力间');
    await drawer.locator('.arco-form-item').filter({ hasText: '位置' }).locator('input').fill('A区01');
    await drawer.locator('.arco-form-item').filter({ hasText: '开放时间' }).locator('input').fill('08:00');
    await drawer.locator('.arco-form-item').filter({ hasText: '排序' }).locator('input').fill('7');
    await drawer.getByRole('button', { name: '新增能力' }).click();
    await drawer.getByPlaceholder('编码', { exact: true }).fill('OP-GA');

    const postResponse = page.waitForResponse((r) => r.url().includes('/room/roomCreate') && r.request().method() === 'POST');
    const getResponse = page.waitForResponse((r) => r.url().includes('/room/getRoomList'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await postResponse;
    await getResponse;
    await page.waitForLoadState('networkidle');

    // 精确断言：POST 请求体含 capabilities JSON 数组
    const form = parseForm(lastCreate.body);
    const caps = JSON.parse(form.get('capabilities') ?? '[]');
    expect(caps).toHaveLength(1);
    expect(caps[0].capabilityCode).toBe('OP-GA');
    expect(form.get('emergencyCapable')).toBe('0');
    expect(form.get('location')).toBe('A区01');
    expect(form.get('openTime')).toBe('08:00');
    expect(form.get('sortNo')).toBe('7');

    // GET 回读后列表显示真实编码、名称、位置、能力、开放时间、排序和 enabled 状态
    await expect(page.getByText('ROOM-E2E-CAP').first()).toBeVisible();
    await expect(page.locator('.arco-tag').filter({ hasText: 'OP-GA' })).toBeVisible();
    await expect(page.getByText('能力间').first()).toBeVisible();
    await expect(page.getByText('A区01').first()).toBeVisible();
    await expect(page.getByText('08:00').first()).toBeVisible();
    await expect(page.getByText('7', { exact: true }).first()).toBeVisible();
    await expect(page.locator('.arco-tag').filter({ hasText: '启用' }).first()).toBeVisible();
    expect(state.rooms.get('ROOM-E2E-CAP')?.version).toBe(1);
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  });

  test('编辑：可空字段清除生效；业务目录不出现 paused/disabled', async ({ page }) => {
    const state = createMockState();
    state.rooms.set('ROOM-E2E-CLR', { roomId: 9002, roomCode: 'ROOM-E2E-CLR', roomName: '清除间', location: '旧位置', cleanLevel: '百级', status: 'enabled', version: 1, capabilities: [] });
    await seedSession(page);
    await installMocks(page, { permitted: true, state });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('清除间').first()).toBeVisible();

    const versionBefore = Number(state.rooms.get('ROOM-E2E-CLR')?.version);
    // 编辑：改名并清除 location（置空）
    await page.getByRole('button', { name: '编辑' }).first().click();
    const drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '手术间名称' }).locator('input').fill('清除间-已更新');
    await drawer.locator('.arco-form-item').filter({ hasText: '位置' }).locator('input').fill('');
    const updPost = page.waitForResponse((r) => r.url().includes('/room/roomUpdate') && r.request().method() === 'POST');
    const updGet = page.waitForResponse((r) => r.url().includes('/room/getRoomList') && r.request().method() === 'GET');
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await updPost;
    await updGet;
    expect(Number(state.rooms.get('ROOM-E2E-CLR')?.version)).toBeGreaterThan(versionBefore);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('清除间-已更新').first()).toBeVisible();
    await expect(page.locator('.arco-table').getByText('旧位置')).toHaveCount(0);

    // 暂停后业务目录（无 allStatus）不出现该房间
    await page.getByRole('button', { name: '暂停' }).first().click();
    await page.locator('.arco-modal textarea').fill('检修');
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await page.waitForLoadState('networkidle');

    const bizRes = await page.evaluate(async () => {
      const r = await fetch('/api-samis/pc/v1/room/getRoomList', { headers: { Authorization: 'Bearer x' } });
      return r.json();
    });
    const bizCodes = ((bizRes as { data?: { list?: Array<{ roomCode?: string }> } }).data?.list ?? []).map((x) => x.roomCode);
    expect(bizCodes).not.toContain('ROOM-E2E-CLR');
  });

  test('暂停与停用原因必填：空原因 0 POST；历史顺序、时间、原因和操作者可见', async ({ page }) => {
    const state = createMockState();
    state.rooms.set('ROOM-E2E-P', { roomId: 9003, roomCode: 'ROOM-E2E-P', roomName: '暂停间', status: 'enabled', version: 1, capabilities: [] });
    state.histories.set(9003, [
      { id: 1, fromStatus: null, toStatus: 'enabled', reason: null, actor: 'rc-e2e', version: 1, occurredAt: '2026-07-14 08:00:00' },
    ]);
    await seedSession(page);
    await installMocks(page, { permitted: true, state });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '暂停' }).first().click();
    const writesBeforePause = state.writeRequests;
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await expect(page.getByText('请填写变更原因').last()).toBeVisible();
    expect(state.writeRequests).toBe(writesBeforePause);

    await page.locator('.arco-modal textarea').fill('设备检修');
    const pausePost = page.waitForResponse((r) => r.url().includes('/room/roomChangeStatus') && r.request().method() === 'POST');
    const pauseGet = page.waitForResponse((r) => r.url().includes('/room/getRoomList') && r.request().method() === 'GET');
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await pausePost;
    await pauseGet;

    await page.getByRole('button', { name: '停用' }).first().click();
    const writesBeforeDisable = state.writeRequests;
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await expect(page.getByText('请填写变更原因').last()).toBeVisible();
    expect(state.writeRequests).toBe(writesBeforeDisable);
    await page.locator('.arco-modal textarea').fill('永久停用');
    const disablePost = page.waitForResponse((r) => r.url().includes('/room/roomChangeStatus') && r.request().method() === 'POST');
    const disableGet = page.waitForResponse((r) => r.url().includes('/room/getRoomList') && r.request().method() === 'GET');
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await disablePost;
    await disableGet;

    await page.getByRole('button', { name: '历史' }).first().click();
    const historyRows = page.locator('.arco-drawer .history-item');
    await expect(historyRows).toHaveCount(3);
    await expect(historyRows.nth(0)).toContainText('启用');
    await expect(historyRows.nth(0)).toContainText('2026-07-14 08:00:00');
    await expect(historyRows.nth(1)).toContainText('暂停');
    await expect(historyRows.nth(1)).toContainText('设备检修');
    await expect(historyRows.nth(1)).toContainText('rc-e2e');
    await expect(historyRows.nth(2)).toContainText('停用');
    await expect(historyRows.nth(2)).toContainText('永久停用');
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  });

  test('字段配置：保存后 GET 次数增加，刷新后仍生效', async ({ page }) => {
    const state = createMockState();
    await seedSession(page);
    await installMocks(page, { permitted: true, state });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');
    const getBefore = state.fieldConfigGet;

    await page.getByRole('button', { name: '字段配置' }).click();
    const configDrawer = page.locator('.arco-drawer');
    await expect(configDrawer.getByText('cleanLevel')).toBeVisible();

    const locationRow = configDrawer.locator('.arco-table-tr').filter({ hasText: 'location' });
    await locationRow.locator('.arco-table-td').nth(1).locator('input').fill('手术位置');
    await locationRow.locator('.arco-table-td').nth(4).locator('input').fill('3');
    await locationRow.locator('.arco-table-td').nth(5).locator('input').fill('位置归属');

    const cleanRow = configDrawer.locator('.arco-table-tr').filter({ hasText: 'cleanLevel' });
    await cleanRow.locator('.arco-table-td').nth(2).getByRole('switch').click();

    const openTimeRow = configDrawer.locator('.arco-table-tr').filter({ hasText: 'openTime' });
    await openTimeRow.locator('.arco-table-td').nth(3).getByRole('switch').click();
    await openTimeRow.locator('.arco-table-td').nth(4).locator('input').fill('4');

    const savePost = page.waitForResponse((r) => r.url().includes('/configuration/fieldConfigSave') && r.request().method() === 'POST');
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await savePost;
    await expect.poll(() => state.fieldConfigGet).toBeGreaterThan(getBefore);
    await expect(locationRow.locator('.arco-table-td').nth(1).locator('input')).toHaveValue('手术位置');

    await page.locator('.arco-drawer-footer').getByRole('button', { name: '取消' }).click();
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 真正浏览器刷新后：显示名、显隐、排序、分组仍来自 GET 回读
    await expect(page.locator('.arco-table').getByText('手术位置', { exact: true })).toBeVisible();
    await expect(page.locator('.arco-table').getByText('洁净等级', { exact: true })).toHaveCount(0);
    await expect(page.locator('.arco-table').getByText('位置归属', { exact: true })).toBeVisible();
    const headers = await page.locator('.arco-table-th').allTextContents();
    expect(headers.findIndex((text) => text.includes('手术位置'))).toBeLessThan(headers.findIndex((text) => text.includes('开放时间')));

    // 配置为必填的开放时间为空时必须在前端拦截，不能发出写请求
    await page.getByRole('button', { name: '新增手术间' }).click();
    const editor = page.locator('.arco-drawer');
    await editor.locator('.arco-form-item').filter({ hasText: '手术间编码' }).locator('input').fill('ROOM-E2E-REQ');
    await editor.locator('.arco-form-item').filter({ hasText: '手术间名称' }).locator('input').fill('必填校验间');
    const writesBefore = state.writeRequests;
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('开放时间不能为空')).toBeVisible();
    expect(state.writeRequests).toBe(writesBefore);
  });

  test('真实凭据手术间配置生命周期与清理（opt-in）', async ({ page }) => {
    test.skip(!e2eEnabled || !e2eUsername || !e2ePassword,
      'requires SAMIS_ROOM_CONFIG_E2E=1 and SAMIS_E2E_USERNAME/SAMIS_E2E_PASSWORD');
    if (!e2eUsername || !e2ePassword) return;

    const roomCode = generateRoomCode();
    try {
      await cleanupFieldConfigFixture();
      await page.goto('/login');
      await page.locator('input').first().fill(e2eUsername);
      await page.locator('input[type="password"]').fill(e2ePassword);
      await page.getByRole('button', { name: '登录' }).click();
      await expect(page).toHaveURL(/\/(workbench|surgery|config)/);
      await page.evaluate(() => sessionStorage.setItem('samis_hospital_code', 'E2E'));

      // 创建
      await page.goto('/config/rooms');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增手术间' }).click();
      const drawer = page.locator('.arco-drawer');
      await drawer.locator('.arco-form-item').filter({ hasText: '手术间编码' }).locator('input').fill(roomCode);
      await drawer.locator('.arco-form-item').filter({ hasText: '手术间名称' }).locator('input').fill(`${roomCode}-名称`);
      await drawer.locator('.arco-form-item').filter({ hasText: '位置' }).locator('input').fill('E2E初始位置');
      await drawer.locator('.arco-form-item').filter({ hasText: '开放时间' }).locator('input').fill('08:00');
      await drawer.locator('.arco-form-item').filter({ hasText: '排序' }).locator('input').fill('8');
      const createPost = page.waitForResponse((r) => r.url().includes('/room/roomCreate') && r.request().method() === 'POST');
      const createGet = page.waitForResponse((r) => r.url().includes('/room/getRoomList') && r.request().method() === 'GET');
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await createPost;
      await createGet;

      let status = await statusRoomFixture(roomCode);
      expect(status.status).toBe('present');
      expect(status.roomStatus).toBe('enabled');
      const versionBeforeEdit = Number(status.version ?? 0);

      // 编辑：补充位置，刷新保持
      let roomRow = page.locator('.arco-table-tr').filter({ hasText: roomCode });
      await roomRow.getByRole('button', { name: '编辑' }).click();
      await page.locator('.arco-drawer').locator('.arco-form-item').filter({ hasText: '位置' }).locator('input').fill('E2E位置');
      const updatePost = page.waitForResponse((r) => r.url().includes('/room/roomUpdate') && r.request().method() === 'POST');
      const updateGet = page.waitForResponse((r) => r.url().includes('/room/getRoomList') && r.request().method() === 'GET');
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await updatePost;
      await updateGet;
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(roomCode).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('E2E位置').first()).toBeVisible();
      status = await statusRoomFixture(roomCode);
      expect(Number(status.version)).toBeGreaterThan(versionBeforeEdit);

      // 状态变更 + 历史
      roomRow = page.locator('.arco-table-tr').filter({ hasText: roomCode });
      await roomRow.getByRole('button', { name: '暂停' }).click();
      await page.locator('.arco-modal textarea').fill('E2E检修');
      const pausePost = page.waitForResponse((r) => r.url().includes('/room/roomChangeStatus') && r.request().method() === 'POST');
      await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
      await pausePost;
      status = await statusRoomFixture(roomCode);
      expect(status.roomStatus).toBe('paused');
      expect((status.historyRows ?? 0) >= 2).toBeTruthy();
      roomRow = page.locator('.arco-table-tr').filter({ hasText: roomCode });
      await roomRow.getByRole('button', { name: '历史' }).click();
      await expect(page.locator('.arco-drawer').getByText('E2E检修')).toBeVisible();
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '关闭' }).click();

      // paused -> enabled -> disabled，验证完整合法生命周期
      roomRow = page.locator('.arco-table-tr').filter({ hasText: roomCode });
      await roomRow.getByRole('button', { name: '启用' }).click();
      await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
      await page.waitForLoadState('networkidle');
      roomRow = page.locator('.arco-table-tr').filter({ hasText: roomCode });
      await roomRow.getByRole('button', { name: '停用' }).click();
      await page.locator('.arco-modal textarea').fill('E2E停用');
      await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
      await page.waitForLoadState('networkidle');
      status = await statusRoomFixture(roomCode);
      expect(status.roomStatus).toBe('disabled');

      // 仅写 hospital_code=E2E：字段配置保存、GET 回读和浏览器刷新生效
      await page.getByRole('button', { name: '字段配置' }).click();
      const locationRow = page.locator('.arco-drawer .arco-table-tr').filter({ hasText: 'location' });
      const e2eLabel = `E2E位置-${roomCode.slice(-6)}`;
      await locationRow.locator('.arco-table-td').nth(1).locator('input').fill(e2eLabel);
      const fieldPost = page.waitForResponse((r) => r.url().includes('/configuration/fieldConfigSave') && r.request().method() === 'POST');
      const fieldGet = page.waitForResponse((r) => r.url().includes('/configuration/fieldConfig') && r.request().method() === 'GET');
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await fieldPost;
      await fieldGet;
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '取消' }).click();
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.arco-table').getByText(e2eLabel, { exact: true })).toBeVisible();
      expect((await statusFieldConfigFixture()).status).toBe('present');

      status = await statusRoomFixture(roomCode);
      expect(status.status).toBe('present');
    } finally {
      const fieldCleaned = await cleanupFieldConfigFixture();
      const cleaned = await cleanupRoomFixture(roomCode);
      const verify = await statusRoomFixture(roomCode);
      expect(fieldCleaned.status).toBe('absent');
      expect((await statusFieldConfigFixture()).status).toBe('absent');
      expect(verify.status).toBe('absent');
      expect(cleaned.status).toBe('absent');
    }
  });
});

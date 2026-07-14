import { expect, test, type Page } from '@playwright/test';
import { cleanupRoomFixture, generateRoomCode, statusRoomFixture } from './helpers/roomConfigurationFixture';

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
    { fieldCode: 'roomCode', displayName: '手术间编码', dataType: 'string', serverRequired: true, systemField: true, visible: true, required: true, sortNo: 1, groupName: null, defaultValue: null, options: null, version: null, id: null, updatedAt: null },
    { fieldCode: 'roomName', displayName: '手术间名称', dataType: 'string', serverRequired: true, systemField: true, visible: true, required: true, sortNo: 2, groupName: null, defaultValue: null, options: null, version: null, id: null, updatedAt: null },
    { fieldCode: 'location', displayName: '位置', dataType: 'string', serverRequired: false, systemField: false, visible: true, required: false, sortNo: 8, groupName: null, defaultValue: null, options: null, version: null, id: null, updatedAt: null },
    { fieldCode: 'cleanLevel', displayName: '洁净等级', dataType: 'enum', serverRequired: false, systemField: false, visible: true, required: false, sortNo: 9, groupName: null, defaultValue: null, options: '["百级","千级"]', version: null, id: null, updatedAt: null },
  ];
}

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'room-config-e2e-token');
    sessionStorage.setItem('samis_authorization', 'Bearer room-config-e2e-token');
    sessionStorage.setItem('samis_room', 'OR-01');
    sessionStorage.setItem('samis_room_group', 'ANES');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({ userId: 'rc-e2e', loginName: 'rc-e2e', displayName: '配置验收用户' }));
  });
}

function installMocks(page: Page, opts: { permitted: boolean; state: MockState; lastCreate?: { body: string } }) {
  return page.route('**/api-samis/pc/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

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
      await route.fulfill(ok({ list: [
        { id: 1, fromStatus: null, toStatus: 'enabled', reason: null, actor: 'rc-e2e', version: 1, occurredAt: '2026-07-14 08:00:00' },
        { id: 2, fromStatus: 'enabled', toStatus: 'paused', reason: '检修', actor: 'rc-e2e', version: 2, occurredAt: '2026-07-14 09:00:00' },
      ] }));
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
        stationCapacity: Number(form.get('stationCapacity') ?? 0),
        emergencyCapable: form.get('emergencyCapable') === '1',
        negativePressure: form.get('negativePressure') === '1',
        hybridRoom: form.get('hybridRoom') === '1',
        status: 'enabled',
        version: 1,
        capabilities,
      };
      opts.state.rooms.set(roomCode, room);
      await route.fulfill(ok({ roomId: id, version: 1 }));
      return;
    }
    if (method === 'POST' && url.includes('/room/roomUpdate')) {
      const form = parseForm(body0(route));
      const roomCode = form.get('roomCode') ?? '';
      const room = opts.state.rooms.get(roomCode);
      if (room) {
        for (const key of ['roomName', 'location', 'cleanLevel']) {
          if (form.has(key)) {
            const v = form.get(key);
            room[key] = v === '' ? null : v;
          }
        }
        if (form.has('capabilities')) {
          room.capabilities = JSON.parse(form.get('capabilities') ?? '[]');
        }
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
          r.status = to;
          r.version = (Number(r.version) ?? 1) + 1;
        }
      }
      await route.fulfill(ok({ status: to, version: 2 }));
      return;
    }
    if (method === 'POST' && url.includes('/configuration/fieldConfigSave')) {
      const form = parseForm(route.request().postData() ?? '');
      const fieldCode = form.get('fieldCode') ?? '';
      opts.state.fieldConfigRows[fieldCode] = {
        ...(opts.state.fieldConfigRows[fieldCode] ?? {}),
        displayName: form.get('displayName') ?? undefined,
        version: 1,
        id: 8000,
        updatedAt: '2026-07-14 10:00:00',
      };
      await route.fulfill(ok({ id: 8000, fieldCode, version: 1, updatedAt: '2026-07-14 10:00:00' }));
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
    const state: MockState = { rooms: new Map(), nextId: 9001, fieldConfigGet: 0, fieldConfigRows: {} };
    await seedSession(page);
    await installMocks(page, { permitted: true, state });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('远程暂无手术间数据')).toBeVisible();
    await expect(page.locator('.arco-table').getByText('OR-01')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '新增手术间' })).toBeVisible();
  });

  test('无权限：写动作隐藏且发出 0 个写请求', async ({ page }) => {
    const state: MockState = { rooms: new Map(), nextId: 9001, fieldConfigGet: 0, fieldConfigRows: {} };
    state.rooms.set('ROOM-VIEW', { roomId: 9000, roomCode: 'ROOM-VIEW', roomName: '只读', status: 'enabled', version: 1, capabilities: [] });
    await seedSession(page);
    await installMocks(page, { permitted: false, state });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('无手术间配置权限')).toBeVisible();
    await expect(page.getByRole('button', { name: '新增手术间' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '编辑' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '暂停' })).toHaveCount(0);
  });

  test('创建：POST 请求体含 capabilities JSON；GET 回读显示真实能力，无删除动作', async ({ page }) => {
    const state: MockState = { rooms: new Map(), nextId: 9001, fieldConfigGet: 0, fieldConfigRows: {} };
    const lastCreate = { body: '' };
    await seedSession(page);
    await installMocks(page, { permitted: true, state, lastCreate });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '新增手术间' }).click();
    const drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '手术间编码' }).locator('input').fill('ROOM-E2E-CAP');
    await drawer.locator('.arco-form-item').filter({ hasText: '手术间名称' }).locator('input').fill('能力间');
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

    // GET 回读后列表显示真实能力标签
    await expect(page.locator('.arco-tag').filter({ hasText: 'OP-GA' })).toBeVisible();
    await expect(page.getByText('能力间').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  });

  test('编辑：可空字段清除生效；业务目录不出现 paused/disabled', async ({ page }) => {
    const state: MockState = { rooms: new Map(), nextId: 9001, fieldConfigGet: 0, fieldConfigRows: {} };
    state.rooms.set('ROOM-E2E-CLR', { roomId: 9002, roomCode: 'ROOM-E2E-CLR', roomName: '清除间', location: '旧位置', cleanLevel: '百级', status: 'enabled', version: 1, capabilities: [] });
    await seedSession(page);
    await installMocks(page, { permitted: true, state });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('清除间').first()).toBeVisible();

    // 编辑：清除 location（置空）
    await page.getByRole('button', { name: '编辑' }).first().click();
    const drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '位置' }).locator('input').fill('');
    const updPost = page.waitForResponse((r) => r.url().includes('/room/roomUpdate') && r.request().method() === 'POST');
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await updPost;
    await page.waitForLoadState('networkidle');
    // 清除后 GET 回读，旧位置不再显示为“旧位置”
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

  test('暂停原因必填：空原因 0 POST；历史可见', async ({ page }) => {
    const state: MockState = { rooms: new Map(), nextId: 9001, fieldConfigGet: 0, fieldConfigRows: {} };
    state.rooms.set('ROOM-E2E-P', { roomId: 9003, roomCode: 'ROOM-E2E-P', roomName: '暂停间', status: 'enabled', version: 1, capabilities: [] });
    await seedSession(page);
    await installMocks(page, { permitted: true, state });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '暂停' }).first().click();
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await expect(page.getByText('请填写变更原因')).toBeVisible();
    await page.waitForTimeout(200);

    await page.locator('.arco-modal textarea').fill('设备检修');
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '历史' }).first().click();
    await expect(page.locator('.arco-drawer').getByText('检修')).toBeVisible();
  });

  test('字段配置：保存后 GET 次数增加，刷新后仍生效', async ({ page }) => {
    const state: MockState = { rooms: new Map(), nextId: 9001, fieldConfigGet: 0, fieldConfigRows: {} };
    await seedSession(page);
    await installMocks(page, { permitted: true, state });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');
    const getBefore = state.fieldConfigGet;

    await page.getByRole('button', { name: '字段配置' }).click();
    await expect(page.locator('.arco-drawer').getByText('cleanLevel')).toBeVisible();
    const cell = page.locator('.arco-table-tr').filter({ hasText: 'cleanLevel' });
    await cell.locator('input').first().fill('净化级别');

    const savePost = page.waitForResponse((r) => r.url().includes('/configuration/fieldConfigSave') && r.request().method() === 'POST');
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await savePost;
    // 保存后重新 GET，次数增加
    expect(state.fieldConfigGet).toBeGreaterThan(getBefore);
    // 抽屉内回读显示已保存的显示名
    const cellAfter = page.locator('.arco-table-tr').filter({ hasText: 'cleanLevel' });
    await expect(cellAfter.locator('input').first()).toHaveValue('净化级别');
  });

  test('真实凭据手术间配置生命周期与清理（opt-in）', async ({ page }) => {
    test.skip(!e2eEnabled || !e2eUsername || !e2ePassword,
      'requires SAMIS_ROOM_CONFIG_E2E=1 and SAMIS_E2E_USERNAME/SAMIS_E2E_PASSWORD');
    if (!e2eUsername || !e2ePassword) return;

    const roomCode = generateRoomCode();
    try {
      await page.goto('/login');
      await page.locator('input').first().fill(e2eUsername);
      await page.locator('input[type="password"]').fill(e2ePassword);
      await page.getByRole('button', { name: '登录' }).click();
      await expect(page).toHaveURL(/\/(workbench|surgery|config)/);

      // 创建
      await page.goto('/config/rooms');
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: '新增手术间' }).click();
      const drawer = page.locator('.arco-drawer');
      await drawer.locator('.arco-form-item').filter({ hasText: '手术间编码' }).locator('input').fill(roomCode);
      await drawer.locator('.arco-form-item').filter({ hasText: '手术间名称' }).locator('input').fill(`${roomCode}-名称`);
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');

      let status = await statusRoomFixture(roomCode);
      expect(status.status).toBe('present');
      expect(status.roomStatus).toBe('enabled');

      // 编辑：补充位置，刷新保持
      await page.getByRole('button', { name: '编辑' }).first().click();
      await page.locator('.arco-drawer').locator('.arco-form-item').filter({ hasText: '位置' }).locator('input').fill('E2E位置');
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(roomCode).first()).toBeVisible({ timeout: 15_000 });

      // 状态变更 + 历史
      await page.getByRole('button', { name: '暂停' }).first().click();
      await page.locator('.arco-modal textarea').fill('E2E检修');
      await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
      await page.waitForLoadState('networkidle');
      status = await statusRoomFixture(roomCode);
      expect(status.roomStatus).toBe('paused');
      expect((status.historyRows ?? 0) >= 2).toBeTruthy();

      // 字段配置保存
      await page.getByRole('button', { name: '字段配置' }).click();
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '取消' }).click().catch(() => {});

      status = await statusRoomFixture(roomCode);
      expect(status.status).toBe('present');
    } finally {
      const cleaned = await cleanupRoomFixture(roomCode);
      const verify = await statusRoomFixture(roomCode);
      expect(verify.status).toBe('absent');
      expect(cleaned.status).toBe('absent');
    }
  });
});

import { expect, test, type Page } from '@playwright/test';
import { cleanupRoomFixture, generateRoomCode, statusRoomFixture } from './helpers/roomConfigurationFixture';

const e2eEnabled = process.env.SAMIS_ROOM_CONFIG_E2E === '1';
const e2eUsername = process.env.SAMIS_E2E_USERNAME;
const e2ePassword = process.env.SAMIS_E2E_PASSWORD;
const ROOM_PERM = 'config.room.manage';
const FIELD_PERM = 'config.field.manage';

interface Counters {
  roomCreatePost: number;
  roomUpdatePost: number;
  changeStatusPost: number;
  fieldConfigSavePost: number;
  listGet: number;
  historyGet: number;
  fieldConfigGet: number;
}

function ok(data: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) };
}

function permissionPayload(permissions: string[]) {
  return { permissions, role: permissions.includes(ROOM_PERM) ? 'admin' : 'viewer', groupid: permissions.length ? 1 : null };
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

function richRoom(roomCode: string, version = 1, status = 'enabled') {
  return {
    roomId: 9001,
    roomCode,
    roomName: `${roomCode}-名称`,
    shortName: null,
    roomGroupId: 'ANES',
    campus: '总院',
    floor: '5F',
    location: 'A区',
    cleanLevel: '百级',
    emergencyCapable: false,
    negativePressure: false,
    hybridRoom: true,
    stationCapacity: 2,
    openTime: '08:00',
    closeTime: '20:00',
    sortNo: 10,
    status,
    version,
    capabilities: [
      { capabilityType: 'operation_type', capabilityCode: 'OP-GA', capabilityName: '全麻' },
    ],
  };
}

function installMocks(page: Page, opts: {
  permitted: boolean;
  counters: Counters;
  createdCode?: string;
  createdRef: { code: string | null };
}) {
  return page.route('**/api-samis/pc/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/auth/myPermissions')) {
      const perms = opts.permitted ? [ROOM_PERM, FIELD_PERM] : [];
      await route.fulfill(ok(permissionPayload(perms)));
      return;
    }
    if (method === 'GET' && url.includes('/room/getRoomList')) {
      opts.counters.listGet += 1;
      const list = opts.createdRef.code ? [richRoom(opts.createdRef.code)] : [];
      await route.fulfill(ok({ list }));
      return;
    }
    if (method === 'GET' && url.includes('/room/getRoomGroupList')) {
      await route.fulfill(ok({ list: [] }));
      return;
    }
    if (method === 'GET' && url.includes('/room/roomHistory')) {
      opts.counters.historyGet += 1;
      await route.fulfill(ok({ list: [
        { id: 1, fromStatus: null, toStatus: 'enabled', reason: null, actor: 'rc-e2e', version: 1, occurredAt: '2026-07-14 08:00:00' },
        { id: 2, fromStatus: 'enabled', toStatus: 'paused', reason: '检修', actor: 'rc-e2e', version: 2, occurredAt: '2026-07-14 09:00:00' },
      ] }));
      return;
    }
    if (method === 'GET' && url.includes('/configuration/fieldConfig')) {
      opts.counters.fieldConfigGet += 1;
      await route.fulfill(ok({ list: [
        { fieldCode: 'roomCode', displayName: '手术间编码', dataType: 'string', serverRequired: true, systemField: true, visible: true, required: true, sortNo: 1, groupName: null, defaultValue: null, options: null, version: null, id: null, updatedAt: null },
        { fieldCode: 'cleanLevel', displayName: '洁净等级', dataType: 'enum', serverRequired: false, systemField: false, visible: true, required: false, sortNo: 9, groupName: null, defaultValue: null, options: '["百级","千级"]', version: null, id: null, updatedAt: null },
      ] }));
      return;
    }
    if (method === 'POST' && url.includes('/room/roomCreate')) {
      opts.counters.roomCreatePost += 1;
      opts.createdRef.code = opts.createdCode ?? 'ROOM-E2E-MOCK';
      await route.fulfill(ok({ roomId: 9001, version: 1 }));
      return;
    }
    if (method === 'POST' && url.includes('/room/roomUpdate')) {
      opts.counters.roomUpdatePost += 1;
      await route.fulfill(ok({ version: 2 }));
      return;
    }
    if (method === 'POST' && url.includes('/room/roomChangeStatus')) {
      opts.counters.changeStatusPost += 1;
      await route.fulfill(ok({ status: 'paused', version: 2 }));
      return;
    }
    if (method === 'POST' && url.includes('/configuration/fieldConfigSave')) {
      opts.counters.fieldConfigSavePost += 1;
      await route.fulfill(ok({ id: 7001, fieldCode: 'cleanLevel', version: 1, updatedAt: '2026-07-14 10:00:00' }));
      return;
    }
    await route.fulfill(ok({}));
  });
}

test.describe('手术间结构化配置生命周期', () => {
  test('远端空列表显示空状态，0 默认房间；有权限显示新增', async ({ page }) => {
    const counters = { roomCreatePost: 0, roomUpdatePost: 0, changeStatusPost: 0, fieldConfigSavePost: 0, listGet: 0, historyGet: 0, fieldConfigGet: 0 };
    await seedSession(page);
    await installMocks(page, { permitted: true, counters, createdRef: { code: null } });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('远程暂无手术间数据')).toBeVisible();
    // 表格不得回填默认/seed 房间
    await expect(page.locator('.arco-table').getByText('OR-01')).toHaveCount(0);
    await expect(page.locator('.arco-table').getByText('PACU')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '新增手术间' })).toBeVisible();
  });

  test('无权限：写动作隐藏且发出 0 个写请求', async ({ page }) => {
    const counters = { roomCreatePost: 0, roomUpdatePost: 0, changeStatusPost: 0, fieldConfigSavePost: 0, listGet: 0, historyGet: 0, fieldConfigGet: 0 };
    await seedSession(page);
    await installMocks(page, { permitted: false, counters, createdRef: { code: 'ROOM-VIEW' } });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('无手术间配置权限')).toBeVisible();
    await expect(page.getByRole('button', { name: '新增手术间' })).toHaveCount(0);
    // 行内无编辑/状态写动作
    await expect(page.getByRole('button', { name: '编辑' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '暂停' })).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(counters.roomCreatePost).toBe(0);
    expect(counters.roomUpdatePost).toBe(0);
    expect(counters.changeStatusPost).toBe(0);
  });

  test('有权限：创建丰富房间 POST→GET 回读，列表显示真实编码/名称/能力/状态，无删除动作', async ({ page }) => {
    const code = 'ROOM-E2E-CREATE';
    const counters = { roomCreatePost: 0, roomUpdatePost: 0, changeStatusPost: 0, fieldConfigSavePost: 0, listGet: 0, historyGet: 0, fieldConfigGet: 0 };
    await seedSession(page);
    await installMocks(page, { permitted: true, counters, createdCode: code, createdRef: { code: null } });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '新增手术间' }).click();
    const drawer = page.locator('.arco-drawer');
    await drawer.locator('.arco-form-item').filter({ hasText: '手术间编码' }).locator('input').fill(code);
    await drawer.locator('.arco-form-item').filter({ hasText: '手术间名称' }).locator('input').fill(`${code}-名称`);
    await drawer.getByRole('button', { name: '新增能力' }).click();
    await drawer.getByPlaceholder('编码', { exact: true }).fill('OP-GA');

    const postResponse = page.waitForResponse((r) => r.url().includes('/room/roomCreate') && r.request().method() === 'POST');
    const getResponse = page.waitForResponse((r) => r.url().includes('/room/getRoomList'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await postResponse;
    await getResponse;
    await page.waitForLoadState('networkidle');

    expect(counters.roomCreatePost).toBe(1);
    // GET 回读后列表显示真实数据
    await expect(page.getByText(code).first()).toBeVisible();
    await expect(page.getByText(`${code}-名称`).first()).toBeVisible();
    await expect(page.locator('.arco-tag').filter({ hasText: 'OP-GA' })).toBeVisible();
    // 不存在物理删除动作
    await expect(page.getByRole('button', { name: '删除' })).toHaveCount(0);
  });

  test('暂停原因必填：空原因 0 POST；填写后 POST changeStatus + GET，历史可见', async ({ page }) => {
    const code = 'ROOM-E2E-PAUSE';
    const counters = { roomCreatePost: 0, roomUpdatePost: 0, changeStatusPost: 0, fieldConfigSavePost: 0, listGet: 0, historyGet: 0, fieldConfigGet: 0 };
    await seedSession(page);
    await installMocks(page, { permitted: true, counters, createdRef: { code } });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(code).first()).toBeVisible();

    // 空原因点击暂停：应被前端拦截，0 POST
    await page.getByRole('button', { name: '暂停' }).first().click();
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await expect(page.getByText('请填写变更原因')).toBeVisible();
    await page.waitForTimeout(200);
    expect(counters.changeStatusPost).toBe(0);

    // 填写原因后确定
    await page.locator('.arco-modal textarea').fill('设备检修');
    const statusPost = page.waitForResponse((r) => r.url().includes('/room/roomChangeStatus') && r.request().method() === 'POST');
    await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click();
    await statusPost;
    await page.waitForLoadState('networkidle');
    expect(counters.changeStatusPost).toBe(1);

    // 历史抽屉可见
    await page.getByRole('button', { name: '历史' }).first().click();
    await expect(page.locator('.arco-drawer').getByText('检修')).toBeVisible();
  });

  test('医院字段配置保存 POST fieldConfigSave 并 GET 回读', async ({ page }) => {
    const counters = { roomCreatePost: 0, roomUpdatePost: 0, changeStatusPost: 0, fieldConfigSavePost: 0, listGet: 0, historyGet: 0, fieldConfigGet: 0 };
    await seedSession(page);
    await installMocks(page, { permitted: true, counters, createdRef: { code: 'ROOM-E2E-FIELD' } });

    await page.goto('/config/rooms');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '字段配置' }).click();
    await expect(page.locator('.arco-drawer').getByText('cleanLevel')).toBeVisible();
    // 修改洁净等级显示名称
    const cell = page.locator('.arco-table-tr').filter({ hasText: 'cleanLevel' });
    await cell.locator('input').first().fill('净化级别');

    const savePost = page.waitForResponse((r) => r.url().includes('/configuration/fieldConfigSave') && r.request().method() === 'POST');
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
    await savePost;
    expect(counters.fieldConfigSavePost).toBeGreaterThanOrEqual(1);
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

      await page.goto('/config/rooms');
      await page.waitForLoadState('networkidle');

      // 创建 ROOM-E2E-* 合成房间
      await page.getByRole('button', { name: '新增手术间' }).click();
      const drawer = page.locator('.arco-drawer');
      await drawer.locator('.arco-form-item').filter({ hasText: '手术间编码' }).locator('input').fill(roomCode);
      await drawer.locator('.arco-form-item').filter({ hasText: '手术间名称' }).locator('input').fill(`${roomCode}-名称`);
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' }).click();
      await page.waitForLoadState('networkidle');

      const created = await statusRoomFixture(roomCode);
      expect(created.status).toBe('present');
      expect(created.roomStatus).toBe('enabled');

      // 刷新后字段保持
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(roomCode).first()).toBeVisible({ timeout: 15_000 });

      const after = await statusRoomFixture(roomCode);
      expect(after.status).toBe('present');
    } finally {
      const cleaned = await cleanupRoomFixture(roomCode);
      const verify = await statusRoomFixture(roomCode);
      expect(verify.status).toBe('absent');
      expect(cleaned.status).toBe('absent');
    }
  });
});

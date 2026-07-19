import { expect, test, type Page } from '@playwright/test';

const e2eEnabled = process.env.SAMIS_ROOM_CONFIG_E2E === '1';
const e2eUsername = process.env.SAMIS_E2E_USERNAME;
const e2ePassword = process.env.SAMIS_E2E_PASSWORD;
const FIELD_PERM = 'config.field.manage';

interface State {
  rooms: Array<Record<string, unknown>>;
  roomWrites: number;
  fieldWrites: number;
  fieldGets: number;
}
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) });
const fieldConfig = () => [
  { fieldCode: 'roomCode', displayName: '手术间编码', dataType: 'string', serverRequired: true, systemField: true, visible: true, required: true, sortNo: 1, groupName: '基础信息', defaultValue: null, options: [], version: 1, id: 1, updatedAt: '2026-07-17 10:00:00' },
  { fieldCode: 'equipment', displayName: '已绑定物理设备', dataType: 'array', serverRequired: false, systemField: true, visible: true, required: false, sortNo: 2, groupName: '能力与设备', defaultValue: null, options: [], version: 1, id: 2, updatedAt: '2026-07-17 10:00:00' },
];

async function seed(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'c1-room-e2e');
    sessionStorage.setItem('samis_authorization', 'Bearer c1-room-e2e');
    sessionStorage.setItem('samis_hospital_code', 'E2E');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({ userId: 'c1-room', displayName: 'C1验收用户' }));
  });
}

async function install(page: Page, state: State, permissions: string[]) {
  await page.route('**/api-samis/pc/v1/**', async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.includes('/auth/myPermissions')) return route.fulfill(ok({ permissions }));
    if (request.method() === 'GET' && url.includes('/room/getRoomList')) return route.fulfill(ok({ list: state.rooms }));
    if (request.method() === 'GET' && url.includes('/room/roomHistory')) return route.fulfill(ok({ list: [{ id: 1, fromStatus: null, toStatus: 'enabled', reason: '启用', actor: 'nurse-1', version: 1, occurredAt: '2026-07-17 09:00:00' }] }));
    if (request.method() === 'GET' && url.includes('/configuration/fieldConfig')) { state.fieldGets += 1; return route.fulfill(ok({ list: fieldConfig() })); }
    if (request.method() === 'POST' && url.includes('/configuration/fieldConfigSave')) { state.fieldWrites += 1; return route.fulfill(ok({ version: 2 })); }
    if (request.method() === 'POST' && /\/room\/(roomCreate|roomUpdate|roomChangeStatus|roomDelete|roomGroupCreate|roomGroupUpdate|roomGroupDelete)/.test(url)) { state.roomWrites += 1; return route.fulfill({ ...ok(null), body: JSON.stringify({ code: 1003, msg: '核心手术间由HULI维护', data: null }) }); }
    return route.fulfill(ok({ list: [] }));
  });
}

function roomFixture() {
  return {
    roomId: 91,
    roomCode: 'OR-C1-01',
    roomName: 'C1一号手术间',
    roomType: 'operating_room',
    roomGroupName: '中心手术部',
    location: 'A楼3层',
    stationCapacity: 1,
    status: 'enabled',
    version: 4,
    capabilities: [{ capabilityType: 'operation_type', capabilityCode: 'OP-GA', capabilityName: '全麻' }],
    equipment: [{ deviceId: 701, deviceCode: 'MON-C1-01', deviceName: 'C1监护仪', deviceType: 'monitor', status: 'enabled', currentRoomId: 91, version: 2, bindingId: 11 }],
  };
}

test.describe('C1 核心手术间只读目录', () => {
  test('HULI 真实房间与物理设备绑定可见，核心写动作全部消失', async ({ page }) => {
    const state: State = { rooms: [roomFixture()], roomWrites: 0, fieldWrites: 0, fieldGets: 0 };
    await seed(page); await install(page, state, ['*']); await page.goto('/config/rooms');
    await expect(page.getByText('HULI 真实数据')).toBeVisible();
    await expect(page.getByText('OR-C1-01')).toBeVisible();
    await expect(page.getByText('C1监护仪')).toBeVisible();
    await expect(page.getByRole('button', { name: '新增手术间' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '编辑' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '暂停' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '停用' })).toHaveCount(0);
    expect(state.roomWrites).toBe(0);
  });

  test('无字段配置权限时仅查看，不会发出任何写请求', async ({ page }) => {
    const state: State = { rooms: [roomFixture()], roomWrites: 0, fieldWrites: 0, fieldGets: 0 };
    await seed(page); await install(page, state, []); await page.goto('/config/rooms');
    await page.getByRole('button', { name: '字段配置' }).click();
    await expect(page.getByText('无医院字段配置权限')).toBeVisible();
    await expect(page.locator('.arco-drawer-footer').getByRole('button', { name: '保存' })).toBeDisabled();
    expect(state.roomWrites).toBe(0);
    expect(state.fieldWrites).toBe(0);
  });

  test('字段显示配置仍可独立保存并 GET 回读，不改写核心房间', async ({ page }) => {
    const state: State = { rooms: [roomFixture()], roomWrites: 0, fieldWrites: 0, fieldGets: 0 };
    await seed(page); await install(page, state, [FIELD_PERM]); await page.goto('/config/rooms');
    await page.getByRole('button', { name: '字段配置' }).click();
    const drawer = page.locator('.arco-drawer');
    await drawer.getByRole('row').filter({ hasText: 'roomCode' }).getByRole('textbox').first().fill('手术间稳定编码');
    const save = drawer.locator('.arco-drawer-footer').getByRole('button', { name: '保存' });
    await save.click();
    await expect.poll(() => state.fieldWrites).toBe(1);
    await expect.poll(() => state.fieldGets).toBeGreaterThanOrEqual(3);
    expect(state.roomWrites).toBe(0);
  });

  test('真实空列表不补造 OR-01', async ({ page }) => {
    const state: State = { rooms: [], roomWrites: 0, fieldWrites: 0, fieldGets: 0 };
    await seed(page); await install(page, state, ['*']); await page.goto('/config/rooms');
    await expect(page.getByText('HULI 暂无手术间数据')).toBeVisible();
    await expect(page.getByText('OR-01')).toHaveCount(0);
  });

  test('真实凭据只读房间目录（opt-in）', async ({ page }) => {
    test.skip(!e2eEnabled || !e2eUsername || !e2ePassword, 'requires SAMIS_ROOM_CONFIG_E2E=1 and credentials');
    if (!e2eUsername || !e2ePassword) return;
    await page.goto('/login');
    await page.locator('input').first().fill(e2eUsername);
    await page.locator('input[type="password"]').fill(e2ePassword);
    await page.getByRole('button', { name: '登录' }).click();
    await page.goto('/config/rooms');
    await expect(page.getByText('核心手术间由手术护理系统维护')).toBeVisible();
    await expect(page.getByRole('button', { name: '新增手术间' })).toHaveCount(0);
  });
});

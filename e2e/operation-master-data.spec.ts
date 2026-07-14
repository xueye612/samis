import { expect, test, type Page } from '@playwright/test';
import {
  cleanupMasterDataFixture,
  setupMasterDataFixture,
  statusMasterDataFixture,
} from './helpers/operationMasterFixture';

const e2eEnabled = process.env.SAMIS_OPERATION_MASTER_E2E === '1';
const e2eUsername = process.env.SAMIS_E2E_USERNAME;
const e2ePassword = process.env.SAMIS_E2E_PASSWORD;
const MASTER_PERM = 'operation.master_data.update';

function ok(data: unknown) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) };
}

function permissionPayload(permissions: string[]) {
  return { permissions, role: permissions.includes(MASTER_PERM) ? 'anesthesiologist' : 'viewer', groupid: permissions.length ? 1 : null };
}

async function seedSession(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'master-data-e2e-token');
    sessionStorage.setItem('samis_authorization', 'Bearer master-data-e2e-token');
    sessionStorage.setItem('samis_room', 'OR-01');
    sessionStorage.setItem('samis_room_group', 'ANES');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({
      userId: 'md-e2e-user', loginName: 'md-e2e-user', displayName: '主数据验收用户',
    }));
  });
}

/** 默认网络拦截用例共享：列表 / 权限 / 审计 / 详情 回填。 */
function installNetworkMocks(page: Page, opts: {
  permitted: boolean;
  counters: { masterPost: number; nursePost: number; stationPost: number; getCount: number; changes: string[] };
  posted: { form?: URLSearchParams };
}) {
  return page.route('**/api-samis/pc/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const saved = opts.counters.masterPost > 0;

    if (url.includes('/operationInfo/getOperationList')) {
      await route.fulfill(ok({ list: [{
        OPERATIONID: 'op-md-2',
        operationCase: {
          operationId: 'op-md-2',
          patientName: saved ? '新姓名' : '旧姓名',
          gender: saved ? '女' : '男',
          age: saved ? 45 : 40,
          sequence: saved ? 3 : 1,
          plannedStartTime: '2026-07-13T08:00:00.000Z',
          plannedEndTime: '2026-07-13T10:00:00.000Z',
          version: saved ? 4 : 3,
          sourceSystem: 'HULI',
          sourceTable: 'operatenotice',
          lastUpdatedAt: '2026-07-13 10:00:00',
        },
      }] }));
      return;
    }
    if (url.includes('/auth/myPermissions')) {
      await route.fulfill(ok(permissionPayload(opts.permitted ? [MASTER_PERM] : [])));
      return;
    }
    if (method === 'POST' && url.includes('/operationInfo/updateOperationInfo')) {
      opts.counters.masterPost += 1;
      opts.posted.form = new URLSearchParams(route.request().postData() ?? '');
      let i = 0;
      while (opts.posted.form.has(`changes[${i}][field]`)) {
        opts.counters.changes.push(opts.posted.form.get(`changes[${i}][field]`) as string);
        i += 1;
      }
      await route.fulfill(ok({ operationId: 'op-md-2' }));
      return;
    }
    if (method === 'POST' && url.includes('/operationInfo/saveNursePb')) {
      opts.counters.nursePost += 1;
      await route.fulfill(ok({}));
      return;
    }
    if (method === 'POST' && url.includes('/operationInfo/updateNumberOfStations')) {
      opts.counters.stationPost += 1;
      await route.fulfill(ok({}));
      return;
    }
    if (method === 'GET' && url.includes('/operationInfo/getOperationInfo')) {
      opts.counters.getCount += 1;
      await route.fulfill(ok({
        OPERATIONID: 'op-md-2',
        operationCase: {
          operationId: 'op-md-2', patientName: '新姓名', gender: '女', age: 45, sequence: 3,
          plannedStartTime: '2026-07-13T09:00:00.000Z', plannedEndTime: '2026-07-13T11:00:00.000Z',
          version: 4, sourceSystem: 'HULI', sourceTable: 'operatenotice', lastUpdatedAt: '2026-07-13 10:30:00',
        },
      }));
      return;
    }
    if (url.includes('/auth/auditByOperation')) {
      await route.fulfill(ok({ list: [{
        module: 'operation', action: 'masterDataUpdate', actorId: 'md-e2e-user', actorRole: 'anesthesiologist',
        occurredAt: '2026-07-13 10:00:00', result: 'success',
        changeSummary: [{ field: 'patientName', label: '患者姓名', before: '旧姓名', after: '新姓名', reason: '修正姓名' }],
      }] }));
      return;
    }
    await route.fulfill(ok({}));
  });
}

async function editMasterFields(page: Page) {
  const drawer = page.locator('.arco-drawer');
  await drawer.locator('.arco-form-item').filter({ hasText: '患者' }).locator('input').first().fill('新姓名');
  // 性别
  await drawer.locator('.arco-form-item').filter({ hasText: '性别' }).locator('.arco-select-view').click();
  await page.locator('.arco-select-option').filter({ hasText: '女' }).first().click();
  // 年龄
  await drawer.locator('.arco-form-item').filter({ hasText: '年龄' }).locator('input').first().fill('45');
  // 预计开始 / 预计结束（日期时间）
  await fillDateTime(page, '预计开始', '2026-07-13 09:00');
  await fillDateTime(page, '预计结束', '2026-07-13 11:00');
  // 台次
  await drawer.locator('.arco-form-item').filter({ hasText: '台次' }).locator('input').first().fill('3');
  // 修改原因
  await page.getByPlaceholder('请填写本次主数据修改原因').fill('修正姓名');
}

async function fillDateTime(page: Page, label: string, value: string) {
  const drawer = page.locator('.arco-drawer');
  const input = drawer.locator('.arco-form-item').filter({ hasText: label }).locator('input').first();
  await input.click();
  await input.fill(value);
  await input.press('Enter');
}

test.describe('手术主数据受控修改', () => {
  test('无权限：编辑控件禁用，0 主数据/护理/台次写请求', async ({ page }) => {
    const counters = { masterPost: 0, nursePost: 0, stationPost: 0, getCount: 0, changes: [] as string[] };
    const posted = { form: undefined as URLSearchParams | undefined };
    await seedSession(page);
    await installNetworkMocks(page, { permitted: false, counters, posted });

    await page.goto('/surgery/schedule');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '编辑' }).first().click();
    // 真实权限结构读取后无权限 → 展示受限提示且控件禁用
    await expect(page.getByText('无手术主数据修改权限')).toBeVisible();
    const drawer = page.locator('.arco-drawer');
    await expect(drawer.locator('.arco-form-item').filter({ hasText: '患者' }).locator('input').first()).toBeDisabled();
    // 确定按钮已禁用
    await expect(page.locator('.arco-drawer-footer').getByRole('button', { name: '确定' })).toBeDisabled();

    // 尝试触发确认保存（确定按钮已禁用，不应产生写请求）
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '确定' }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);

    expect(counters.masterPost).toBe(0);
    expect(counters.nursePost).toBe(0);
    expect(counters.stationPost).toBe(0);
    await expect(page.getByText('排班已保存')).toHaveCount(0);
  });

  test('有权限：POST 六字段信封 → GET 回读新版本 → 审计展示 → 刷新保持', async ({ page }) => {
    const counters = { masterPost: 0, nursePost: 0, stationPost: 0, getCount: 0, changes: [] as string[] };
    const posted = { form: undefined as URLSearchParams | undefined };
    await seedSession(page);
    await installNetworkMocks(page, { permitted: true, counters, posted });

    await page.goto('/surgery/schedule');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '编辑' }).first().click();
    await expect(page.getByPlaceholder('请填写本次主数据修改原因')).toBeVisible();

    await editMasterFields(page);

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/operationInfo/updateOperationInfo') && r.request().method() === 'POST'),
      page.locator('.arco-drawer-footer').getByRole('button', { name: '确定' }).click(),
    ]);
    // POST 之后必须 GET 回读，随后护理排班独立保存
    await page.waitForResponse((r) => r.url().includes('/operationInfo/getOperationInfo'));
    await expect(page.getByText('排班已保存')).toBeVisible();
    await page.waitForLoadState('networkidle');

    // 1. POST 信封包含 operationId、expectedVersion、reason 和六个规范 changes
    expect(counters.masterPost).toBeGreaterThanOrEqual(1);
    expect(posted.form?.get('operationId')).toBe('op-md-2');
    expect(posted.form?.get('expectedVersion')).toBe('3');
    expect(posted.form?.get('reason')).toBe('修正姓名');
    expect([...counters.changes].sort()).toEqual(
      ['age', 'gender', 'patientName', 'plannedEndTime', 'plannedStartTime', 'sequence'],
    );
    // 台次随主数据信封保存，不再调用无版本/原因的旁路接口
    expect(counters.stationPost).toBe(0);
    // 护理排班在主数据 POST→GET 成功后独立执行
    expect(counters.nursePost).toBeGreaterThanOrEqual(1);
    // 2. POST 之后 GET 回读新版本
    expect(counters.getCount).toBeGreaterThanOrEqual(1);

    // 3. 刷新后再次 GET，页面仍显示服务端新值
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('新姓名').first()).toBeVisible();

    // 4. 重新打开抽屉：展示版本/来源元数据与逐字段审计历史
    await page.getByRole('button', { name: '编辑' }).first().click();
    await expect(page.locator('.arco-drawer').getByText('operatenotice').first()).toBeVisible();
    const auditSection = page.locator('.arco-drawer .drawer-audit');
    await expect(auditSection).toBeVisible();
    await expect(auditSection.getByText('旧姓名').first()).toBeVisible();
    await expect(auditSection.getByText('新姓名').first()).toBeVisible();
    await expect(auditSection.getByText('修正姓名').first()).toBeVisible();
    await expect(auditSection.getByText('md-e2e-user')).toBeVisible();
    await expect(auditSection.getByText('anesthesiologist')).toBeVisible();
    await expect(auditSection.getByText('2026-07-13 10:00:00')).toBeVisible();
  });

  test('真实凭据主数据保存与清理（opt-in）', async ({ page }) => {
    test.skip(!e2eEnabled || !e2eUsername || !e2ePassword,
      'requires SAMIS_OPERATION_MASTER_E2E=1 and SAMIS_E2E_USERNAME/SAMIS_E2E_PASSWORD');
    if (!e2eUsername || !e2ePassword) return;

    // 1. 登录真实账号
    await page.goto('/login');
    await page.locator('input').first().fill(e2eUsername);
    await page.locator('input[type="password"]').fill(e2ePassword);
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page).toHaveURL(/\/(workbench|surgery)/);
    await expect(page.getByText('Token缺失')).toHaveCount(0);

    // 2. 从会话取得真实 roomCode/roomGroup
    const roomCode = await page.evaluate(() => sessionStorage.getItem('samis_room') ?? '');
    const roomGroup = await page.evaluate(() => sessionStorage.getItem('samis_room_group') ?? '');
    expect(roomCode, '登录后会话应包含 samis_room').toBeTruthy();

    // 3. setup 唯一 OP-E2E-SCHEDULE-* 合成病例（不预先播种，由 CLI 创建并返回唯一 ID）
    const fixture = await setupMasterDataFixture(roomCode, roomGroup);
    const operationId = fixture.operationId;
    expect(fixture.status).toBe('present');
    expect(fixture.visible).toBe(true);

    try {
      // 4. 打开排班并定位该合成病例（住院号列展示 patientId=operationId）
      await page.goto('/surgery/schedule');
      await page.waitForLoadState('networkidle');
      const targetRow = page.locator('tr').filter({ hasText: operationId });
      await expect(targetRow.first()).toBeVisible({ timeout: 15_000 });

      const versionBefore = await readDrawerVersion(page, targetRow);

      // 5. 修改患者姓名/性别，填写原因
      await targetRow.first().getByRole('button', { name: '编辑' }).click();
      const drawer = page.locator('.arco-drawer');
      await drawer.locator('.arco-form-item').filter({ hasText: '患者' }).locator('input').first()
        .fill(`${operationId}-修正`);
      await drawer.locator('.arco-form-item').filter({ hasText: '性别' }).locator('.arco-select-view').click();
      await page.locator('.arco-select-option').filter({ hasText: '女' }).first().click();
      await page.getByPlaceholder('请填写本次主数据修改原因').fill('E2E 合成病例主数据回归');

      // 6. 明确点击名称为“确定”的按钮
      // 7. 等待主数据 POST 和详情 GET
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/operationInfo/updateOperationInfo') && r.request().method() === 'POST'),
        page.locator('.arco-drawer-footer').getByRole('button', { name: '确定' }).click(),
      ]);
      await page.waitForResponse((r) => r.url().includes('/operationInfo/getOperationInfo'));
      await page.waitForLoadState('networkidle');

      // 8. 验证新版本与刷新保持
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('tr').filter({ hasText: operationId }).first()).toBeVisible();
      const versionAfter = await readDrawerVersion(page, page.locator('tr').filter({ hasText: operationId }));
      expect(versionAfter, '保存后版本号应递增').toBeGreaterThan(versionBefore);

      // 审计记录：重新打开抽屉，状态列展示成功或审计待确认
      await page.locator('tr').filter({ hasText: operationId }).first().getByRole('button', { name: '编辑' }).click();
      await expect(page.locator('.arco-drawer .drawer-audit').getByText(/成功|审计待确认/).first()).toBeVisible({ timeout: 10_000 });
    } finally {
      // 9. finally 无条件清理；10. cleanup 后 status 必须为 absent
      await cleanupMasterDataFixture(operationId);
      const after = await statusMasterDataFixture(operationId);
      expect(after.status).toBe('absent');
    }
  });
});

/** 打开某行编辑抽屉并读取版本号元数据（无版本时返回 -1），随后保持抽屉关闭以便后续操作。 */
async function readDrawerVersion(page: Page, row: import('@playwright/test').Locator): Promise<number> {
  await row.first().getByRole('button', { name: '编辑' }).click();
  const drawer = page.locator('.arco-drawer');
  const metaText = await drawer.locator('.arco-descriptions').first().innerText().catch(() => '');
  // 关闭抽屉，避免影响后续步骤
  await page.locator('.arco-drawer-footer').getByRole('button', { name: '取消' }).click().catch(() => {});
  const match = metaText.match(/版本[^\d-]*(-?\d+)/);
  if (!match) return -1;
  return Number(match[1]);
}

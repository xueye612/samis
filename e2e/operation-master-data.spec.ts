import { expect, test, type Page } from '@playwright/test';
import {
  cleanupMasterDataFixture,
  generateMasterDataOperationId,
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
      // 模拟审计回读的异步延迟，暴露即时读取竞态
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill(ok({ list: [{
        module: 'operation', action: 'masterDataUpdate', actorId: 'md-e2e-user', actorRole: 'anesthesiologist',
        occurredAt: '2026-07-13 10:00:00', result: 'success',
        changeSummary: [
          { field: 'patientName', label: '患者姓名', before: '旧姓名', after: '新姓名', reason: '修正姓名' },
          { field: 'gender', label: '性别', before: '男', after: '女', reason: '修正姓名' },
        ],
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

    // 点击“确定”前同时创建 POST 与 GET response waiter，消除 POST→GET 回读竞态
    const postResponse = page.waitForResponse((r) => r.url().includes('/operationInfo/updateOperationInfo') && r.request().method() === 'POST');
    const getResponse = page.waitForResponse((r) => r.url().includes('/operationInfo/getOperationInfo'));
    await page.locator('.arco-drawer-footer').getByRole('button', { name: '确定' }).click();
    await postResponse;
    await getResponse;
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

    // 4. 重新打开抽屉：展示版本/来源元数据、刷新后姓名与性别展示、逐字段审计历史
    await page.getByRole('button', { name: '编辑' }).first().click();
    const drawer = page.locator('.arco-drawer');
    await expect(drawer.locator('.arco-form-item').filter({ hasText: '患者' }).locator('input').first())
      .toHaveValue('新姓名');
    await expect(drawer.locator('.arco-form-item').filter({ hasText: '性别' }).locator('.arco-select-view'))
      .toContainText('女');
    await expect(page.locator('.arco-drawer').getByText('operatenotice').first()).toBeVisible();
    // 审计：两条对应字段行（患者姓名 / 性别）
    const auditRows = await readAuditRows(page, 2);
    const nameRow = auditRows.find((r) => r.field === '患者姓名');
    const genderRow = auditRows.find((r) => r.field === '性别');
    expect(nameRow, '审计应包含患者姓名行').toBeTruthy();
    expect(genderRow, '审计应包含性别行').toBeTruthy();
    expect(nameRow?.after).toBe('新姓名');
    expect(nameRow?.reason).toBe('修正姓名');
    expect(nameRow?.status).toBe('成功');
    expect(genderRow?.after).toBe('女');
    expect(genderRow?.reason).toBe('修正姓名');
    expect(genderRow?.status).toBe('成功');
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

    // 3. 测试端先确定已知、唯一、≤50 的 OP-E2E-SCHEDULE-* operationId，立即进入 try
    const operationId = generateMasterDataOperationId();
    const reason = 'E2E 合成病例主数据回归';
    const newName = `${operationId}-修正`;

    try {
      // setup 接收显式 operationId 并传给 CLI；不依赖 CLI 返回才知道 id
      const fixture = await setupMasterDataFixture(operationId, roomCode, roomGroup);
      expect(fixture.operationId).toBe(operationId);
      const present = await statusMasterDataFixture(operationId);
      expect(present.status).toBe('present');
      expect(present.visible).toBe(true);

      // 4. 打开排班并定位该合成病例（住院号列展示 patientId=operationId）
      await page.goto('/surgery/schedule');
      await page.waitForLoadState('networkidle');
      const targetRow = () => page.locator('tr').filter({ hasText: operationId });
      await expect(targetRow().first()).toBeVisible({ timeout: 15_000 });
      const versionBefore = await readDrawerVersion(page, targetRow());

      // 5. 修改患者姓名/性别，填写原因
      await targetRow().first().getByRole('button', { name: '编辑' }).click();
      const drawer = page.locator('.arco-drawer');
      await drawer.locator('.arco-form-item').filter({ hasText: '患者' }).locator('input').first().fill(newName);
      await drawer.locator('.arco-form-item').filter({ hasText: '性别' }).locator('.arco-select-view').click();
      await page.locator('.arco-select-option').filter({ hasText: '女' }).first().click();
      await page.getByPlaceholder('请填写本次主数据修改原因').fill(reason);

      // 6. 明确点击名称为“确定”的按钮；7. 等待主数据 POST 和详情 GET（点击前同时创建两个 waiter）
      const postResponse = page.waitForResponse((r) => r.url().includes('/operationInfo/updateOperationInfo') && r.request().method() === 'POST');
      const getResponse = page.waitForResponse((r) => r.url().includes('/operationInfo/getOperationInfo'));
      await page.locator('.arco-drawer-footer').getByRole('button', { name: '确定' }).click();
      await postResponse;
      await getResponse;
      await page.waitForLoadState('networkidle');

      // 8. 刷新后验证：目标行显示修改后姓名、重新打开抽屉患者输入值=修改后姓名、性别=女、版本严格递增
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(targetRow().first()).toBeVisible();
      await expect(targetRow().first()).toContainText(newName);
      const versionAfter = await readDrawerVersion(page, targetRow());
      expect(versionAfter, '保存后版本号应严格大于修改前').toBeGreaterThan(versionBefore);

      await targetRow().first().getByRole('button', { name: '编辑' }).click();
      const drawerAfter = page.locator('.arco-drawer');
      await expect(drawerAfter.locator('.arco-form-item').filter({ hasText: '患者' }).locator('input').first())
        .toHaveValue(newName);
      await expect(drawerAfter.locator('.arco-form-item').filter({ hasText: '性别' }).locator('.arco-select-view'))
        .toContainText('女');

      // 审计必须验证两条对应字段行（精确“成功”，不得放宽为 /成功|审计待确认/）
      const auditRows = await readAuditRows(page, 2);
      const nameRow = auditRows.find((r) => r.field === '患者姓名');
      const genderRow = auditRows.find((r) => r.field === '性别');
      expect(nameRow, '审计应包含患者姓名行').toBeTruthy();
      expect(genderRow, '审计应包含性别行').toBeTruthy();
      expect(nameRow?.after).toBe(newName);
      expect(nameRow?.reason).toBe(reason);
      expect(nameRow?.status).toBe('成功');
      expect(genderRow?.after).toBe('女');
      expect(genderRow?.reason).toBe(reason);
      expect(genderRow?.status).toBe('成功');
    } finally {
      // 9. finally 无条件清理（setup 未写入时也因幂等安全）；10. cleanup 后 status 必须精确为 absent
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
  await page.locator('.arco-drawer-footer').getByRole('button', { name: '取消' }).click().catch(() => '');
  const match = metaText.match(/版本[^\d-]*(-?\d+)/);
  return match ? Number(match[1]) : -1;
}

/** 读取抽屉审计表全部行：列序为 状态/字段/变更前/变更后/原因/操作人/角色/时间。
 *  在读取 count/allInnerTexts 前用 Playwright 自动等待达到 expectedCount，消除异步回读竞态。 */
async function readAuditRows(page: Page, expectedCount: number): Promise<Array<{ status: string; field: string; before: string; after: string; reason: string }>> {
  const rows = page.locator('.arco-drawer .drawer-audit tbody tr');
  await expect(rows).toHaveCount(expectedCount, { timeout: 10_000 });
  const count = await rows.count();
  const out: Array<{ status: string; field: string; before: string; after: string; reason: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const cells = await rows.nth(i).locator('td').allInnerTexts();
    out.push({
      status: (cells[0] ?? '').trim(),
      field: (cells[1] ?? '').trim(),
      before: (cells[2] ?? '').trim(),
      after: (cells[3] ?? '').trim(),
      reason: (cells[4] ?? '').trim(),
    });
  }
  return out;
}

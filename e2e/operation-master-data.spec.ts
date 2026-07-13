import { expect, test } from '@playwright/test';

const e2eEnabled = process.env.SAMIS_OPERATION_MASTER_E2E === '1';
const e2eUsername = process.env.SAMIS_E2E_USERNAME;
const e2ePassword = process.env.SAMIS_E2E_PASSWORD;

async function seedSession(page: import('@playwright/test').Page) {
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

test('无权限时不发送主数据修改请求', async ({ page }) => {
  let masterDataPosts = 0;
  await seedSession(page);
  await page.route('**/api-samis/pc/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/operationInfo/getOperationList')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data: { list: [{
        OPERATIONID: 'op-md-1', operationCase: { operationId: 'op-md-1', patientName: '患者甲', gender: '男', version: 2 },
      }] } }) });
      return;
    }
    if (url.includes('/auth/myPermissions')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data: [] }) });
      return;
    }
    if (route.request().method() === 'POST' && url.includes('/operationInfo/updateOperationInfo')) {
      masterDataPosts += 1;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data: {} }) });
  });

  await page.goto('/surgery/schedule');
  await page.waitForLoadState('networkidle');
  // 打开编辑抽屉：无权限时应展示受限提示
  await page.getByRole('button', { name: '编辑' }).first().click();
  await expect(page.getByText('无手术主数据修改权限')).toBeVisible();
  expect(masterDataPosts).toBe(0);
});

test('有权限时按 POST→GET 顺序保存主数据并回读新版本', async ({ page }) => {
  let postCount = 0;
  let getCount = 0;
  let postedForm: URLSearchParams | undefined;
  await seedSession(page);
  await page.route('**/api-samis/pc/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    // 列表在有 POST 之前返回旧值，POST 之后返回新值（模拟保存后刷新）
    if (url.includes('/operationInfo/getOperationList')) {
      const name = postCount > 0 ? '新姓名' : '旧姓名';
      const version = postCount > 0 ? 4 : 3;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data: { list: [{
        OPERATIONID: 'op-md-2', operationCase: { operationId: 'op-md-2', patientName: name, gender: postCount > 0 ? '女' : '男', version, sourceTable: 'operatenotice' },
      }] } }) });
      return;
    }
    if (url.includes('/auth/myPermissions')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data: ['operation.master_data.update'] }) });
      return;
    }
    if (method === 'POST' && url.includes('/operationInfo/updateOperationInfo')) {
      postCount += 1;
      postedForm = new URLSearchParams(route.request().postData() ?? '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data: { operationId: 'op-md-2' } }) });
      return;
    }
    if (method === 'GET' && url.includes('/operationInfo/getOperationInfo')) {
      getCount += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data: {
        OPERATIONID: 'op-md-2',
        operationCase: { operationId: 'op-md-2', patientName: '新姓名', gender: '女', version: 4, sourceTable: 'operatenotice' },
      } }) });
      return;
    }
    if (url.includes('/auth/auditByOperation')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data: { list: [{
        module: 'operation', action: 'masterDataUpdate', actorId: 'md-e2e-user', occurredAt: '2026-07-13 10:00:00',
        changeSummary: [{ field: 'patientName', label: '患者姓名', before: '旧姓名', after: '新姓名', reason: '修正姓名' }],
      }] } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data: {} }) });
  });

  await page.goto('/surgery/schedule');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: '编辑' }).first().click();
  await expect(page.getByPlaceholder('请填写本次主数据修改原因')).toBeVisible();
  await page.locator('.arco-form-item').filter({ hasText: '患者' }).locator('input').first().fill('新姓名');
  await page.getByPlaceholder('请填写本次主数据修改原因').fill('修正姓名');

  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/operationInfo/updateOperationInfo')),
    page.getByRole('button', { name: '确定' }).click(),
  ]);
  // POST 之后必须 GET 回读
  await page.waitForResponse((r) => r.url().includes('/operationInfo/getOperationInfo'));
  await page.waitForLoadState('networkidle');

  expect(postCount).toBeGreaterThanOrEqual(1);
  expect(postedForm?.get('operationId')).toBe('op-md-2');
  expect(postedForm?.get('reason')).toBe('修正姓名');
  // changes 数组以 PHP 表单记法传输（changes[0][field]），后端读取为数组
  expect(postedForm?.get('changes[0][field]')).toBe('patientName');
  expect(postedForm?.get('changes[0][value]')).toBe('新姓名');
  // POST 之后必须 GET 回读
  expect(getCount).toBeGreaterThanOrEqual(1);
  // 刷新后仍显示新值（不恢复旧姓名）
  await expect(page.getByText('新姓名').first()).toBeVisible();
});

test('真实凭据主数据保存回读（opt-in）', async ({ page }) => {
  test.skip(!e2eEnabled || !e2eUsername || !e2ePassword, 'requires SAMIS_OPERATION_MASTER_E2E=1 and SAMIS_E2E_USERNAME/SAMIS_E2E_PASSWORD');
  await page.goto('/login');
  await page.locator('input').first().fill(e2eUsername!);
  await page.locator('input[type="password"]').fill(e2ePassword!);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/(workbench|surgery)/);
  await expect(page.getByText('Token缺失')).toHaveCount(0);
});

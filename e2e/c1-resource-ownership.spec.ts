import { expect, test, type Page, type Request } from '@playwright/test';

const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) });
const form = (request: Request) => new URLSearchParams(request.postData() ?? '');
interface State { writes: Array<{ path: string; fields: URLSearchParams }>; previews: number; }

async function seed(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'c1-resource-e2e');
    sessionStorage.setItem('samis_authorization', 'Bearer c1-resource-e2e');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({ userId: 'c1-resource', displayName: 'C1资源用户' }));
  });
}

async function install(page: Page, state: State, permissions = ['pacu.resource.manage']) {
  await page.route('**/api-samis/pc/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/auth/myPermissions')) return route.fulfill(ok({ permissions }));
    if (path.endsWith('/auxiliaryLocation/locationList')) return route.fulfill(ok({ list: [{ locationId: 12, locationCode: 'DEL-01', locationName: '产房麻醉位', locationType: 'delivery_room', campus: '本部', floor: '3F', location: '产房A区', status: 'enabled', version: 3, reason: null }] }));
    if (path.endsWith('/pacu/bedList')) return route.fulfill(ok({ list: [{ bedId: 'BED-01', roomId: 'PACU-1', bedNo: '01', status: '空闲', currentOperationId: null, remark: null, version: 2 }] }));
    if (request.method() === 'POST') state.writes.push({ path, fields: form(request) });
    if (path.endsWith('/auxiliaryLocation/impactPreview')) { state.previews += 1; return route.fulfill(ok({ resourceId: 12, resourceVersion: 3, changeDigest: 'a', impactToken: 'aux-token', expiresAt: '2026-07-17 12:05:00', hasImpact: true, warnings: ['该资源已被麻醉预约或占用，继续修改可能影响排班/接收'], impacts: [{ operationId: 'OP-C1-AUX-1', status: 'reserved', version: 1 }] })); }
    if (path.endsWith('/pacu/bedImpactPreview')) { state.previews += 1; return route.fulfill(ok({ resourceId: 'BED-01', resourceVersion: 2, changeDigest: 'b', impactToken: 'bed-token', expiresAt: '2026-07-17 12:05:00', hasImpact: true, warnings: ['该资源已被麻醉预约或占用，继续修改可能影响排班/接收'], impacts: [{ operationId: 'OP-C1-BED-1', status: '预留', version: 2 }] })); }
    if (path.endsWith('/auxiliaryLocation/locationUpdate') || path.endsWith('/pacu/bedUpdate')) return route.fulfill(ok({ version: 4 }));
    return route.fulfill(ok({}));
  });
}

test.describe('C1 辅助资源影响确认', () => {
  test('无权限时辅助区域与 PACU 床位仅查看且 0 写请求', async ({ page }) => {
    const state: State = { writes: [], previews: 0 };
    await seed(page); await install(page, state, []); await page.goto('/config/auxiliary-resources');
    await expect(page.getByText('pacu.resource.manage')).toBeVisible();
    await expect(page.getByRole('button', { name: '新增辅助区域' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '编辑' })).toHaveCount(0);
    expect(state.writes).toHaveLength(0);
  });

  test('产房麻醉位变更必须预检、展示非敏感影响后才能确认', async ({ page }) => {
    const state: State = { writes: [], previews: 0 };
    await seed(page); await install(page, state); await page.goto('/config/auxiliary-resources');
    await page.getByRole('row').filter({ hasText: 'DEL-01' }).getByRole('button', { name: '编辑' }).click();
    const editor = page.locator('.arco-modal').filter({ hasText: '编辑辅助麻醉区域' });
    await editor.locator('.arco-form-item').filter({ hasText: '位置名称' }).getByRole('textbox').fill('产房麻醉位A');
    await editor.locator('.arco-form-item').filter({ hasText: '变更原因' }).getByRole('textbox').fill('产房布局调整');
    await editor.getByRole('button', { name: '确定' }).click();
    const impact = page.locator('.arco-modal').filter({ hasText: '资源影响确认' });
    await expect(impact.getByText('OP-C1-AUX-1')).toBeVisible();
    await expect(impact.getByText('患者姓名')).toHaveCount(0);
    await expect(impact.getByText('住院号')).toHaveCount(0);
    await impact.getByRole('button', { name: '确认变更' }).click();
    const preview = state.writes.find((item) => item.path.endsWith('/impactPreview'))!;
    expect(JSON.parse(preview.fields.get('changes') ?? '{}')).toMatchObject({ locationName: '产房麻醉位A' });
    const update = state.writes.find((item) => item.path.endsWith('/locationUpdate'))!;
    expect(update.fields.get('impactToken')).toBe('aux-token');
    expect(update.fields.get('confirmImpact')).toBe('true');
    expect(update.fields.get('reason')).toBe('产房布局调整');
  });

  test('PACU 床位变更同样经过一次性 token，不传递患者字段', async ({ page }) => {
    const state: State = { writes: [], previews: 0 };
    await seed(page); await install(page, state); await page.goto('/config/auxiliary-resources');
    await page.getByText('PACU 床位', { exact: true }).click();
    await page.getByRole('row').filter({ hasText: 'PACU-1' }).getByRole('button', { name: '编辑' }).click();
    const editor = page.locator('.arco-modal').filter({ hasText: '编辑PACU 床位' });
    await editor.locator('.arco-form-item').filter({ hasText: '备注' }).getByRole('textbox').fill('设备保养');
    await editor.locator('.arco-form-item').filter({ hasText: '变更原因' }).getByRole('textbox').fill('保养调整');
    await editor.getByRole('button', { name: '确定' }).click();
    const impact = page.locator('.arco-modal').filter({ hasText: '资源影响确认' });
    await expect(impact.getByText('OP-C1-BED-1')).toBeVisible();
    await impact.getByRole('button', { name: '确认变更' }).click();
    const update = state.writes.find((item) => item.path.endsWith('/pacu/bedUpdate'))!;
    expect(update.fields.get('impactToken')).toBe('bed-token');
    expect(update.fields.get('sourceSystem')).toBe('SAMIS');
    expect(update.fields.has('patientName')).toBe(false);
    expect(update.fields.has('currentOperationId')).toBe(false);
  });
});

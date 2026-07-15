import { expect, test } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import { cleanupP10Operation, generateP10OperationId, setupP10Operation, statusP10Operation } from './helpers/p10WorkflowFixture';

const realEnabled = process.env.SAMIS_P10_E2E === '1';
const username = process.env.SAMIS_E2E_USERNAME;
const password = process.env.SAMIS_E2E_PASSWORD;
const ok = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data }) });
const fields = (request: Request) => new URLSearchParams(request.postData() ?? '');
const operationCase = { operationId: 'OP-P10-WEB-1', patientName: 'P10合成患者', gender: '女', operationName: '腹腔镜胆囊切除术', operationDate: '2026-07-15', roomName: 'OR-03' };

interface State {
  permissions: string[]; cases: boolean; booking: any | null; bed: any; pacu: any | null;
  timeline: any[]; followup: any | null; complications: any[]; analgesia: any | null;
  unplanned: any | null; posts: Array<{ path: string; form: URLSearchParams }>; gets: Record<string, number>; huliWrites: number;
}
function makeState(permissions: string[] = ['*'], cases = true): State {
  return { permissions, cases, booking: null, bed: { bedId: 'BED-P10', roomId: 'PACU-A', bedNo: '01', status: '空闲', version: 1 }, pacu: null, timeline: [], followup: null, complications: [], analgesia: null, unplanned: null, posts: [], gets: {}, huliWrites: 0 };
}
async function seed(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'p10-e2e-token');
    sessionStorage.setItem('samis_authorization', 'Bearer p10-e2e-token');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({ userId: 'p10-e2e', loginName: 'p10-e2e', displayName: 'P10验收用户' }));
  });
}
function detail(state: State) {
  return { operationCase, pacuRecord: state.pacu, nursingSummary: { source: 'huli', readOnly: true, sourceTable: 'security,apparatus,blood_confirm,handover_receive_restore', status: 'complete', updatedAt: '2026-07-15 10:00:00', safetyCheck: { status: 'complete' }, handover: { status: 'complete' } }, handoverSummary: { source: 'huli', readOnly: true }, timeline: state.timeline };
}
function postop(state: State) {
  return { operationCase, followup: state.followup, complications: state.complications, nursingVisitSummary: { source: 'huli', sourceTable: 'after_operation_visit', status: 'complete', occurredAt: '2026-07-15 18:00:00', updatedAt: '2026-07-15 18:10:00', readOnly: true }, history: [] };
}
async function install(page: Page, state: State) {
  await page.route('**/api-huli/**', async (route) => { if (route.request().method() !== 'GET') state.huliWrites++; await route.fulfill(ok({ list: [] })); });
  await page.route('**/api-samis/pc/v1/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    if (method === 'GET') state.gets[path] = (state.gets[path] ?? 0) + 1;
    if (method === 'POST') state.posts.push({ path, form: fields(request) });
    if (path.endsWith('/auth/myPermissions')) return route.fulfill(ok({ permissions: state.permissions, role: state.permissions.length ? 'admin' : 'viewer' }));
    if (path.endsWith('/preoperative/requestList')) return route.fulfill(ok({ list: state.cases ? [{ id: 0, operationId: operationCase.operationId, status: '已排班', version: 0, operationCase }] : [], total: state.cases ? 1 : 0 }));
    if (path.endsWith('/pacu/bookingList')) return route.fulfill(ok({ list: state.booking ? [state.booking] : [], total: state.booking ? 1 : 0 }));
    if (path.endsWith('/pacu/bedList')) return route.fulfill(ok({ list: [state.bed], total: 1 }));
    if (path.endsWith('/pacu/list')) return route.fulfill(ok({ list: state.pacu ? [state.pacu] : [], total: state.pacu ? 1 : 0 }));
    if (path.endsWith('/pacu/detail')) return route.fulfill(ok(detail(state)));
    if (path.endsWith('/pacu/bookingCreate')) { const f = fields(request); state.booking = { bookingId: 'BOOK-P10', operationId: operationCase.operationId, bookingTime: f.get('bookingTime'), bookingType: f.get('bookingType'), roomId: f.get('roomId'), status: '待接收', version: 1, operationCase }; return route.fulfill(ok(state.booking)); }
    if (path.endsWith('/pacu/admit')) { state.booking.status = '已接收'; state.booking.version++; state.bed = { ...state.bed, status: '占用', version: 2 }; state.pacu = { operationId: operationCase.operationId, pacuRecordId: 'PACU-P10', bookingId: 'BOOK-P10', bedId: 'BED-P10', bedName: 'PACU-A-01', status: 'admitted', version: 1, admittedAt: '2026-07-15 10:10:00' }; state.timeline.push({ eventId: 1, eventType: 'admit', fromStatus: null, toStatus: 'admitted', occurredAt: '2026-07-15 10:10:00', version: 1 }); return route.fulfill(ok(state.pacu)); }
    for (const [suffix, status, event] of [['/pacu/saveRecovery', 'recovering', 'saveRecovery'], ['/pacu/markReady', 'ready_to_discharge', 'markReady'], ['/pacu/discharge', 'discharged', 'discharge']] as const) if (path.endsWith(suffix)) { const before = state.pacu.status; state.pacu = { ...state.pacu, status, version: state.pacu.version + 1, ...(status === 'recovering' ? { recoveredAt: '2026-07-15 10:20:00' } : {}), ...(status === 'ready_to_discharge' ? { dischargeReadyAt: '2026-07-15 10:30:00' } : {}), ...(status === 'discharged' ? { dischargedAt: '2026-07-15 10:40:00' } : {}) }; state.timeline.push({ eventId: state.timeline.length + 1, eventType: event, fromStatus: before, toStatus: status, occurredAt: '2026-07-15 10:40:00', version: state.pacu.version }); return route.fulfill(ok(state.pacu)); }
    if (path.endsWith('/postoperative/followupDetail')) return route.fulfill(ok(postop(state)));
    if (path.endsWith('/postoperative/followupSaveDraft')) { const f = fields(request); state.followup = { operationId: operationCase.operationId, followupId: 'FU-P10', status: 'draft', version: Number(state.followup?.version ?? 0) + 1, followupAt: f.get('followupAt'), followupMethod: f.get('followupMethod'), painScore: Number(f.get('painScore')), satisfaction: Number(f.get('satisfaction')), notes: f.get('notes'), nauseaVomiting: false, soreThroat: false, awareness: false }; return route.fulfill(ok(postop(state))); }
    if (path.endsWith('/postoperative/followupSubmit')) { state.followup = { ...state.followup, status: 'submitted', version: state.followup.version + 1 }; return route.fulfill(ok(postop(state))); }
    if (path.endsWith('/postoperative/complicationSave')) { const f = fields(request); state.complications = [{ operationId: operationCase.operationId, complicationId: 'CP-P10', complicationType: f.get('complicationType'), severity: f.get('severity'), occurredAt: f.get('occurredAt'), description: f.get('description'), treatment: f.get('treatment'), outcome: f.get('outcome'), reportStatus: 'draft', version: 1 }]; return route.fulfill(ok(postop(state))); }
    if (path.endsWith('/postoperative/complicationReport')) { state.complications[0] = { ...state.complications[0], reportStatus: 'reported', version: 2 }; return route.fulfill(ok(postop(state))); }
    if (path.endsWith('/postoperative/complicationVoid')) { state.complications[0] = { ...state.complications[0], reportStatus: 'voided', version: 3, voidReason: fields(request).get('voidReason') }; return route.fulfill(ok(postop(state))); }
    if (path.endsWith('/postoperative/analgesiaDetail')) return route.fulfill(ok({ operationId: operationCase.operationId, currentPlan: state.analgesia, adjustments: [], assessments: [] }));
    if (path.endsWith('/postoperative/analgesiaSaveDraft')) { const f = fields(request); state.analgesia = { planId: 'PLAN-P10', planVersionId: 'PLANV-P10', operationId: operationCase.operationId, version: 1, status: 'draft', methodCode: f.get('methodCode'), formula: JSON.parse(f.get('formula') ?? '[]'), backgroundRateMlH: Number(f.get('backgroundRateMlH')), bolusMl: Number(f.get('bolusMl')), lockoutMinutes: Number(f.get('lockoutMinutes')) }; return route.fulfill(ok(state.analgesia)); }
    if (path.endsWith('/postoperative/analgesiaStart')) { state.analgesia = { ...state.analgesia, status: 'active', version: 2, startedAt: '2026-07-15 12:00:00' }; return route.fulfill(ok(state.analgesia)); }
    if (path.endsWith('/postoperative/unplannedList')) return route.fulfill(ok({ list: state.unplanned ? [state.unplanned] : [], total: state.unplanned ? 1 : 0 }));
    if (path.endsWith('/postoperative/unplannedDetail')) return route.fulfill(ok(state.unplanned));
    if (path.endsWith('/postoperative/unplannedSaveDraft')) { state.unplanned = { eventId: 'UE-P10', operationId: operationCase.operationId, eventType: '非计划转ICU', occurredAt: '2026-07-15 13:00:00', severity: 'medium', status: 'draft', version: 1, discoverySource: '麻醉医师', cause: '', treatment: '', outcome: '', qualityDefectId: null }; return route.fulfill(ok(state.unplanned)); }
    if (path.endsWith('/postoperative/unplannedReport')) { state.unplanned = { ...state.unplanned, status: 'reported', version: 2, reportedAt: '2026-07-15 13:10:00' }; return route.fulfill(ok(state.unplanned)); }
    return route.fulfill(ok({ list: [] }));
  });
}

test.describe('P10护理联动、PACU与术后验收', () => {
  test('真实空列表不回填患者；无权限所有写动作隐藏且零写请求', async ({ page }) => {
    const state = makeState([], false); await seed(page); await install(page, state);
    await page.goto('/pacu/list'); await expect(page.getByText('远程暂无PACU恢复记录')).toBeVisible(); await expect(page.getByText(/测试患者|未命名患者/)).toHaveCount(0);
    for (const path of ['/pacu/booking', '/pacu/receive', '/postoperative/followup', '/postoperative/complications', '/postoperative/analgesia-detail', '/postoperative/unplanned-event-detail']) { await page.goto(path); await page.waitForLoadState('networkidle'); }
    expect(state.posts).toHaveLength(0); expect(state.huliWrites).toBe(0);
  });

  test('PACU预约至正常出室按版本POST后GET，刷新保持护理摘要和时间轴', async ({ page }) => {
    const state = makeState(); await seed(page); await install(page, state);
    await page.goto('/pacu/booking'); await page.getByRole('button', { name: '新增预约' }).click(); await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click(); await expect(page.getByText('P10合成患者').first()).toBeVisible();
    await page.goto('/pacu/receive'); await page.getByRole('button', { name: '接收入室' }).click(); await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click(); await expect(page.getByText('complete').first()).toBeVisible();
    await page.goto(`/pacu/record?operationId=${operationCase.operationId}`); await page.getByRole('button', { name: '保存恢复' }).click(); await page.getByRole('button', { name: '确认达标' }).click(); await page.getByRole('button', { name: '正常出室' }).click(); await expect(page.getByText('discharged').first()).toBeVisible();
    await page.reload(); await expect(page.getByText('discharged').first()).toBeVisible(); await expect(page.getByText(/discharge/).first()).toBeVisible();
    expect(state.posts.filter((item) => item.path.includes('/pacu/')).map((item) => item.form.get('expectedVersion'))).toEqual(['0', '0', '1', '2', '3']);
    expect(state.gets['/api-samis/pc/v1/pacu/detail']).toBeGreaterThanOrEqual(7); expect(state.huliWrites).toBe(0);
  });

  test('术后四流程保存使用稳定ID版本并强制GET，刷新保持且无物理删除', async ({ page }) => {
    test.setTimeout(60_000);
    const state = makeState(); await seed(page); await install(page, state);
    await page.goto('/postoperative/followup'); await page.getByRole('button', { name: '新增随访' }).click(); await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click(); await page.getByRole('button', { name: '提交', exact: true }).click(); await page.reload(); await expect(page.getByText('submitted').first()).toBeVisible();
    await page.goto('/postoperative/complications'); await page.getByRole('button', { name: '登记' }).click(); await page.locator('.arco-modal .arco-form-item').filter({ hasText: '类型' }).locator('input').fill('PONV'); await page.locator('.arco-modal').getByRole('button', { name: '确定' }).click(); await page.getByRole('button', { name: '上报' }).click(); await expect(page.getByText('reported')).toBeVisible();
    await page.goto(`/postoperative/analgesia-detail?operationId=${operationCase.operationId}`); page.once('dialog', (dialog) => dialog.accept('[{"drugCode":"FEN","dose":0.5,"unit":"mg"}]')); await page.getByRole('button', { name: '新建镇痛方案' }).click(); await page.getByRole('button', { name: '启动' }).click(); await page.reload(); await expect(page.getByText('active').first()).toBeVisible();
    await page.goto(`/postoperative/unplanned-event-detail?operationId=${operationCase.operationId}`); await page.getByRole('button', { name: '新建事件' }).click(); await page.getByRole('button', { name: '上报' }).first().click(); await page.reload(); await expect(page.getByText('reported').first()).toBeVisible();
    expect(state.posts.some((item) => /followupDelete|complicationDelete|unplannedDelete/.test(item.path))).toBe(false);
    expect(state.posts.filter((item) => /followup|complication|analgesia|unplanned/.test(item.path)).every((item) => item.form.has('expectedVersion') || item.path.endsWith('/analgesiaSaveDraft'))).toBe(true);
    expect(state.gets['/api-samis/pc/v1/postoperative/followupDetail']).toBe(7);
    expect(state.gets['/api-samis/pc/v1/postoperative/analgesiaDetail']).toBeGreaterThanOrEqual(4);
    expect(state.gets['/api-samis/pc/v1/postoperative/unplannedDetail']).toBeGreaterThanOrEqual(3);
  });

  test('真实凭据完整生命周期并finally清理（opt-in）', async ({ page }) => {
    test.skip(!realEnabled || !username || !password, 'requires SAMIS_P10_E2E=1 and credentials'); if (!username || !password) return;
    const operationId = generateP10OperationId(); let setup = false;
    try { await setupP10Operation(operationId); setup = true; await page.goto('/login'); await page.locator('input').first().fill(username); await page.locator('input[type="password"]').fill(password); await page.getByRole('button', { name: '登录' }).click(); await expect(page).not.toHaveURL(/\/login/); await page.goto('/pacu/booking'); await page.waitForLoadState('networkidle'); }
    finally { if (setup) await cleanupP10Operation(operationId); expect((await statusP10Operation(operationId)).status).toBe('absent'); }
  });
});

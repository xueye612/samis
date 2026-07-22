import { expect, type Page } from '@playwright/test';

export const DEFAULT_RECORD_CASE_ID = 'case-or02';
const isLoginPath = (pathname: string) => pathname.replace(/\/+$/, '').endsWith('/login');

export async function openAnesthesiaRecord(page: Page, caseId = DEFAULT_RECORD_CASE_ID) {
  await page.goto(`/surgery/record/${caseId}`, { waitUntil: 'domcontentloaded' });
  const bypassLoginHint = page.locator('p').filter({ hasText: /Mock 登录|登录绕过（开发模式）/ }).first();
  // Vue 路由守卫可能在 page.goto 返回后才完成重定向，等待登录页或工作台真正渲染。
  await page.waitForFunction(() => (
    window.location.pathname.replace(/\/+$/, '').endsWith('/login')
      || Boolean(document.querySelector('.anesthesia-record-workstation'))
  ), undefined, { timeout: 15_000 });
  if (isLoginPath(new URL(page.url()).pathname)) {
    await expect(bypassLoginHint).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.waitForURL((url) => !isLoginPath(url.pathname), { timeout: 15_000 });
  }
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.locator('.anesthesia-record-workstation')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.sheet-hydration-shell')).toHaveCount(0, { timeout: 45_000 });
  await expect(page.locator('.live-record-card').first()).toBeVisible({ timeout: 15_000 });
}

export async function ensureRecordUnlocked(page: Page) {
  const lockedTag = page.locator('.top-context .arco-tag').filter({ hasText: /已锁定/ });
  if (await lockedTag.count()) {
    throw new Error('当前记录单已锁定，无法执行设备模拟或录入测试');
  }
}

export async function readPaperField(page: Page, label: string) {
  const field = page.locator('.paper-field').filter({
    has: page.locator('.paper-field-label', { hasText: label }),
  }).first();
  await expect(field).toBeVisible();
  return ((await field.locator('.paper-field-value').textContent()) ?? '').trim();
}

export async function readPatientSnapshot(page: Page) {
  return {
    name: await readPaperField(page, '姓名'),
    gender: await readPaperField(page, '性别'),
    age: await readPaperField(page, '年龄'),
    diagnosis: await readPaperField(page, '术前诊断'),
    surgery: await readPaperField(page, '拟施手术'),
  };
}

export async function waitForLocalSavedChip(page: Page) {
  await expect(page.locator('.record-status-bar .sync-chip').filter({ hasText: /网络在线|网络离线|最近同步|待上传/ }).first()).toBeVisible({
    timeout: 15_000,
  });
}

export async function addFirstQuickEvent(page: Page) {
  const button = page.locator('.topbar-row-tools button.arco-btn-outline:not([disabled])').first();
  await expect(button).toBeVisible({ timeout: 10_000 });
  await button.click();
}

export async function ensureDeviceWorkbenchVisible(page: Page) {
  const panel = page.locator('.toolbox-collapse .arco-collapse-item').filter({ hasText: '设备与同步' });
  const content = panel.locator('.device-workbench');
  if (!(await content.isVisible())) {
    await panel.locator('.arco-collapse-item-header').click();
  }
  await expect(content).toBeVisible({ timeout: 10_000 });
}

export async function startMonitorMockFromWorkbench(page: Page) {
  await ensureDeviceWorkbenchVisible(page);
  await page.locator('.device-line[data-device="monitor"] button').click();
}

export async function stopMonitorMockFromWorkbench(page: Page) {
  await ensureDeviceWorkbenchVisible(page);
  await page.locator('.device-line[data-device="monitor"] button').click();
}

export async function startVentilatorMockFromWorkbench(page: Page) {
  await ensureDeviceWorkbenchVisible(page);
  await page.locator('.device-line[data-device="ventilator"] button').click();
}

export async function stopVentilatorMockFromWorkbench(page: Page) {
  await ensureDeviceWorkbenchVisible(page);
  await page.locator('.device-line[data-device="ventilator"] button').click();
}

export async function startMonitorMockFromQuickToolbar(page: Page) {
  const button = page.locator('.device-quick').getByRole('button', { name: '启动监护仪' });
  await expect(button).toBeVisible({ timeout: 10_000 });
  await button.click();
}

export async function stopMonitorMockFromQuickToolbar(page: Page) {
  const button = page.locator('.device-quick').getByRole('button', { name: '停止监护仪' });
  await expect(button).toBeVisible({ timeout: 10_000 });
  await button.click();
}

export async function getRecordSheetBox(page: Page) {
  return page.locator('.live-record-card').first().boundingBox();
}

// 右侧三标签侧栏：切换到指定标签并确保其内容面板可见。
export async function openSideTab(page: Page, testId: 'side-tab-task' | 'side-tab-device' | 'side-tab-reminder') {
  const tab = page.getByTestId(testId);
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await tab.click();
  await page.waitForTimeout(120);
}

// 展开患者表头完整信息（屏幕模式默认折叠为单行摘要）。
export async function expandPatientHeader(page: Page) {
  const editBtn = page.getByTestId('record-header-edit');
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();
  await expect(page.getByTestId('record-header-expanded')).toBeVisible({ timeout: 5_000 });
}


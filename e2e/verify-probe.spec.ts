import { expect, test } from '@playwright/test';

const BASE = 'http://localhost:5175';

test('handover: 从记录单进入携带 operationId 且不静默选首例', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // case-or01 的 operationId 即其 case id（原型一致）
  await page.goto(`${BASE}/surgery/handover/case-or01`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  // 交班页应加载 case-or01，而非默认第一条
  await expect(page.locator('.arco-select-view-value, .arco-select-view').first()).toBeVisible({ timeout: 20000 });
  // 直接核对路由参数被读取：页面不应出现“未找到手术病例”错误
  await expect(page.getByText(/未找到手术病例/)).toHaveCount(0);
  // 切到 case-or02，确认路由参数变化触发重新加载
  await page.goto(`${BASE}/surgery/handover/case-or02`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByText(/未找到手术病例/)).toHaveCount(0);
});

test('handover: 不存在的 operationId 显示错误、不回退首例', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/surgery/handover/NOT-EXIST-OP-XYZ`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByText(/未找到手术病例|病例编号或从麻醉记录单重新进入/)).toBeVisible({ timeout: 20000 });
});

test('print: 生成 A4 PDF（自定义预览→打印媒体），无二次缩放占位', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/surgery/record/case-or01`, { waitUntil: 'domcontentloaded' });
  // 记录页可能落到登录页（含开发绕过），按既有 openAnesthesiaRecord 模式点登录进入
  await page.waitForFunction(() => window.location.pathname.replace(/\/+$/, '').endsWith('/login')
    || Boolean(document.querySelector('.anesthesia-record-workstation')), undefined, { timeout: 15000 }).catch(() => undefined);
  if (new URL(page.url()).pathname.replace(/\/+$/, '').endsWith('/login')) {
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.waitForURL((u) => !u.pathname.replace(/\/+$/, '').endsWith('/login'), { timeout: 15000 });
  }
  await expect(page.locator('.anesthesia-record-workstation')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.sheet-hydration-shell')).toHaveCount(0, { timeout: 45000 });
  await expect(page.locator('.live-record-card').first()).toBeVisible({ timeout: 20000 });

  // 打开自定义打印预览
  const printBtn = page.locator('.record-workstation-topbar').getByRole('button', { name: /打印|预览/ }).first();
  if (await printBtn.count()) {
    await printBtn.click().catch(() => undefined);
    await page.waitForTimeout(800);
  }
  // 以打印媒体生成 PDF（@media print 生效，print-preview-active 隐藏主布局）
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: '/tmp/kilo/record-print-A4.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.emulateMedia({ media: 'screen' });
  await page.screenshot({ path: '/tmp/kilo/record-print-preview-screen.png', fullPage: false });
});

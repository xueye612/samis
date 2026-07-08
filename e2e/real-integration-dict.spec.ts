import { expect, test, type Page } from '@playwright/test';
import { getOnPathname, login } from './helpers/realIntegration';

/**
 * T01 第二轮联调（anesthesiaDict/*）真实浏览器验证。
 * 前置：samisWeb/.env.local 已启用 VITE_USE_REAL_ANESTHESIA_DICT=true；
 *       vite 代理 target 指向本地 index 192.168.10.178:8022；
 *       后端 route/samis.php 已补注册 getStaff/getVitalDict（及 save/disable）共 6 条路由。
 * 运行：容器内 `node_modules/.bin/playwright test e2e/real-integration-dict.spec.ts`。
 *
 * 实测时序（与计划原假设不同，已据实调整）：
 *   - 应用启动期（main.ts:23 + router.beforeEach）会在 token 就绪前发整批 dict GET → 全部 400（Token缺失），
 *     且 localPersistenceReady 守卫使登录后不再重发（见登记缺陷 T21）。
 *   - 但访问各 /config/* 页面时，配置页会以有效 token 重新拉取对应 dict → 200。
 *   故本冒烟在“登录后导航到配置页”时捕获响应并断言 code:0（真实可用链路）。
 * 来源计划：.kilo/plans/1783417413321-samis-real-integration-auth-op-room.md（round 2）。
 */

/** 捕获首个匹配且 HTTP 200 的响应（跳过启动期 400）。基于带 /api-samis/ 前缀守卫的 getOnPathname。 */
function waitForDictOk(page: Page, path: string) {
  const isMatch = getOnPathname(`/anesthesiaDict/${path}`);
  return page.waitForResponse((r) => isMatch(r) && r.status() === 200, { timeout: 15_000 });
}

test.describe('T01 第二轮：anesthesiaDict 走真', () => {
  test('drug：登录后访问药品页，getDrugDict 真链路 code:0、页面渲染', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    // 登录后导航到配置页，此时以有效 token 重新拉取（启动期 400 已结束）
    const drugResp = waitForDictOk(page, 'getDrugDict');
    await page.goto('/config/drugs', { waitUntil: 'domcontentloaded' });

    const r = await drugResp;
    const b = await r.json();
    expect(b.code).toBe(0);
    expect(Array.isArray(b.data?.list)).toBeTruthy();
    // 库内仅有 1 条停用种子（舒芬太尼, enabled=false）→ enabled=1 过滤后为空，属正常
    await expect(page).toHaveURL(/\/config\/drugs/);
    await expect(page.getByText('药品管理').first()).toBeVisible({ timeout: 10_000 });
  });

  test('vitals：登录后访问体征页，getVitalDict 真链路 code:0 且非空、页面渲染', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    const vitalResp = waitForDictOk(page, 'getVitalDict');
    await page.goto('/config/vitals', { waitUntil: 'domcontentloaded' });

    const r = await vitalResp;
    const b = await r.json();
    expect(b.code).toBe(0);
    expect(b.data?.list?.length).toBeGreaterThan(0); // 体征表有 10 条种子
    await expect(page).toHaveURL(/\/config\/vitals/);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

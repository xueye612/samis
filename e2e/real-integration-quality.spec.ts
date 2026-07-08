import { expect, test } from '@playwright/test';
import { getOnPathname, login } from './helpers/realIntegration';

/**
 * T01 第五轮联调（quality 质控）真实浏览器读路径冒烟。
 * 前置：samisWeb/.env.local 已启用 VITE_USE_REAL_QUALITY=true；
 *        vite 代理 target 指向本地 index 192.168.10.178:8022；samis 库 anes_* 质控源表已建。
 * 运行：容器内 `node_modules/.bin/playwright test e2e/real-integration-quality.spec.ts`。
 *
 * 加载时机（已核实代码）：
 *   - hypothermia / adverseEvents / overview 三页均在 onMounted 内 `if (useRealQuality())` 守卫
 *     触发对应 loadRemote* 拉取，goto 页面即可捕获响应。
 *   - indicators（26 指标页 QualityDashboard）：T28 后 onMounted 即 `loadRemoteIndicators` +
 *     默认选中指标 `loadRemoteIndicatorDetail`，切换指标 watch 触发 detail 重拉（真实模式）。
 * 权威写往返/业务规则/合成病例计算正确性由 T3/T4 curl 矩阵覆盖；本浏览器冒烟只验「真链路读路径可达 + code:0 + 渲染」。
 * 来源计划：.kilo/plans/1783417413321-samis-real-integration-auth-op-room.md（round 5，quality）。
 */

test.describe('T01 第五轮：quality 走真（浏览器读冒烟）', () => {
  test('hypothermia：低体温专项页 onMounted 拉 hypothermiaCases 真链路 code:0', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    const listResp = page.waitForResponse(getOnPathname('/quality/hypothermiaCases'), {
      timeout: 30_000,
    });
    await page.goto('/quality/hypothermia', { waitUntil: 'domcontentloaded' });
    const r = await listResp;
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.code).toBe(0);
    // 信封结构回归守卫：聚合返回 { total, list }
    expect(b.data).toHaveProperty('total');
    expect(Array.isArray(b.data?.list)).toBeTruthy();
    await expect(page).toHaveURL(/\/quality\/hypothermia/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('adverseEvents：不良事件统计页 onMounted 拉 adverseEvents 真链路 code:0', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    const listResp = page.waitForResponse(getOnPathname('/quality/adverseEvents'), {
      timeout: 30_000,
    });
    await page.goto('/quality/adverse-events', { waitUntil: 'domcontentloaded' });
    const r = await listResp;
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.code).toBe(0);
    // 信封结构回归守卫：聚合返回 { total, list }
    expect(b.data).toHaveProperty('total');
    expect(Array.isArray(b.data?.list)).toBeTruthy();
    await expect(page).toHaveURL(/\/quality\/adverse-events/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('overview：质控总览页 onMounted 拉 checkList 真链路 code:0', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    const listResp = page.waitForResponse(getOnPathname('/quality/checkList'), {
      timeout: 30_000,
    });
    await page.goto('/quality/overview', { waitUntil: 'domcontentloaded' });
    const r = await listResp;
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.code).toBe(0);
    // 信封结构回归守卫：分页返回 { list, total }
    expect(b.data).toHaveProperty('total');
    expect(Array.isArray(b.data?.list)).toBeTruthy();
    await expect(page).toHaveURL(/\/quality\/overview/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('indicators：质控面板 onMounted 拉 getIndicators(26 行) + 默认选中指标拉 getIndicatorDetail 真链路 code:0', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    // T28：QualityDashboard onMounted 真实模式连发 getIndicators + getIndicatorDetail(默认选中)
    const indicatorsResp = page.waitForResponse(getOnPathname('/quality/indicators'), {
      timeout: 30_000,
    });
    const detailResp = page.waitForResponse(getOnPathname('/quality/indicatorDetail'), {
      timeout: 30_000,
    });
    await page.goto('/quality/dashboard', { waitUntil: 'domcontentloaded' });

    const ri = await indicatorsResp;
    expect(ri.status()).toBe(200);
    const bi = await ri.json();
    expect(bi.code).toBe(0);
    expect(Array.isArray(bi.data)).toBeTruthy();
    // 26 项国家麻醉质控指标权威行
    expect(bi.data.length).toBe(26);

    const rd = await detailResp;
    expect(rd.status()).toBe(200);
    const bd = await rd.json();
    expect(bd.code).toBe(0);
    // 穿透详情信封守卫：含分子/分母 case 列表
    expect(bd.data).toHaveProperty('numeratorCases');
    expect(bd.data).toHaveProperty('denominatorCases');
    await expect(page).toHaveURL(/\/quality\/dashboard/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('indicatorDetail：切换选中指标 watch 触发 getIndicatorDetail 真链路 code:0', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    await page.goto('/quality/dashboard', { waitUntil: 'domcontentloaded' });
    // 等初始 getIndicators 完成，列表卡片渲染就绪
    await page.waitForResponse(getOnPathname('/quality/indicators'), { timeout: 30_000 });
    await expect(page.locator('.indicator-card').first()).toBeVisible({ timeout: 30_000 });

    // T28：点击列表另一张指标卡 → watch(selectedIndicatorCode) 触发 loadRemoteIndicatorDetail
    const detailResp = page.waitForResponse(getOnPathname('/quality/indicatorDetail'), {
      timeout: 30_000,
    });
    await page.locator('.indicator-card').nth(1).click();
    const r = await detailResp;
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.code).toBe(0);
    expect(b.data).toHaveProperty('numeratorCases');
    await expect(page).not.toHaveURL(/\/login/);
  });
});

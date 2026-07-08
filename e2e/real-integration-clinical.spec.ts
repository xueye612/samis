import { expect, test } from '@playwright/test';
import { getOnPathname, login } from './helpers/realIntegration';

/**
 * T01 第四轮联调（pacu + postoperative + preoperative）真实浏览器读路径冒烟。
 * 前置：samisWeb/.env.local 已启用
 *        VITE_USE_REAL_PACU=true + VITE_USE_REAL_POSTOPERATIVE=true + VITE_USE_REAL_PREOPERATIVE=true；
 *        vite 代理 target 指向本地 index 192.168.10.178:8022；samis 库三模块表已建。
 * 运行：容器内 `node_modules/.bin/playwright test e2e/real-integration-clinical.spec.ts`。
 *
 * 加载时机（已核实代码 + 实测修正）：
 *   - PACU：页面 onMounted 内 `if (useRealPacu())` 守卫触发 loadRemotePacuList/Beds
 *     （bootstrapRemoteConfigs 含 PACU 预载，但当前未在登录流程调用——见 PacuList.vue 修复注释；
 *      故改为页面挂载捕获，与 postop/preop 一致）。
 *   - postop/preop：页面 onMounted 内 `if (useRealX())` 守卫触发拉取，goto 页面即可捕获。
 * 权威写往返/业务规则由 T2 curl 矩阵覆盖（93/93）；本浏览器冒烟只验「真链路读路径可达 + code:0 + 渲染」。
 * 来源计划：.kilo/plans/1783417413321-samis-real-integration-auth-op-room.md（round 4）。
 */

test.describe('T01 第四轮：pacu / postoperative / preoperative 走真（浏览器读冒烟）', () => {
  test('PACU：恢复室页 onMounted 拉 /pacu/list 真链路 code:0 + 渲染', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    const listResp = page.waitForResponse(getOnPathname('/pacu/list'), { timeout: 30_000 });
    await page.goto('/pacu/list', { waitUntil: 'domcontentloaded' });
    const r = await listResp;
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.code).toBe(0);
    // 信封结构回归守卫：分页返回 { list, total }
    expect(b.data).toHaveProperty('total');
    expect(Array.isArray(b.data?.list)).toBeTruthy();
    await expect(page).toHaveURL(/\/pacu\/list/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('postoperative：术后随访页 onMounted 拉 followupList 真链路 code:0', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    const listResp = page.waitForResponse(getOnPathname('/postoperative/followupList'), {
      timeout: 30_000,
    });
    await page.goto('/postoperative/followup', { waitUntil: 'domcontentloaded' });
    const r = await listResp;
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.code).toBe(0);
    // 信封结构回归守卫：分页返回 { list, total }
    expect(b.data).toHaveProperty('total');
    expect(Array.isArray(b.data?.list)).toBeTruthy();
    await expect(page).toHaveURL(/\/postoperative\/followup/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('preoperative：手术申请接收页 onMounted 拉 requestList 真链路 code:0', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    const listResp = page.waitForResponse(getOnPathname('/preoperative/requestList'), {
      timeout: 30_000,
    });
    await page.goto('/preoperative/requests', { waitUntil: 'domcontentloaded' });
    const r = await listResp;
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.code).toBe(0);
    // 信封结构回归守卫：分页返回 { list, total }
    expect(b.data).toHaveProperty('total');
    expect(Array.isArray(b.data?.list)).toBeTruthy();
    await expect(page).toHaveURL(/\/preoperative\/requests/);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

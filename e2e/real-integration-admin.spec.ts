import { expect, test } from '@playwright/test';
import { getOnPathname, login } from './helpers/realIntegration';

/**
 * T04/T05 系统管理真实浏览器读路径冒烟。
 * 前置：samisWeb/.env.local 已启用 VITE_USE_REAL_ADMIN=true；
 *        vite 代理 target 指向本地 index（如 192.168.10.178:8022）；samis 库 user_information/admin_user_group/admin_category 已建。
 * 运行：容器内 `node_modules/.bin/playwright test e2e/real-integration-admin.spec.ts`。
 *
 * 加载时机（已核实代码）：
 *   - SystemUsers.vue onMounted 内 `if (useRealAdmin())` 守卫，先 loadRemoteAdminUserGroups
 *     （adminUserGroupsList）再 loadRemoteAdminUsers（adminUserList）。
 *   - SystemRoles.vue onMounted 内 `if (useRealAdmin())` 并发 adminUserGroupsList + getMenu。
 * 权威写往返（create/update/delete）由 curl(token) 矩阵覆盖；本浏览器冒烟只验「真链路读路径可达 + code:0 + 渲染」。
 * 来源计划：.kilo/plans/1783417413321-samis-real-integration-auth-op-room.md（T04/T05）。
 */

test.describe('T04/T05 系统管理走真（浏览器读冒烟）', () => {
  test('SystemUsers：/system/users onMounted 拉 adminUserGroupsList + adminUserList 真链路 code:0', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    const groupsResp = page.waitForResponse(getOnPathname('/adminUserGroup/adminUserGroupsList'), {
      timeout: 30_000,
    });
    const usersResp = page.waitForResponse(getOnPathname('/adminUser/adminUserList'), {
      timeout: 30_000,
    });
    await page.goto('/system/users', { waitUntil: 'domcontentloaded' });

    const rg = await groupsResp;
    expect(rg.status()).toBe(200);
    const bg = await rg.json();
    expect(bg.code).toBe(0);
    expect(bg.data).toHaveProperty('total');
    expect(Array.isArray(bg.data?.list)).toBeTruthy();

    const ru = await usersResp;
    expect(ru.status()).toBe(200);
    const bu = await ru.json();
    expect(bu.code).toBe(0);
    expect(bu.data).toHaveProperty('total');
    expect(Array.isArray(bu.data?.list)).toBeTruthy();
    await expect(page).toHaveURL(/\/system\/users/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('SystemRoles：/system/roles onMounted 拉 adminUserGroupsList + getMenu 真链路 code:0', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    const groupsResp = page.waitForResponse(getOnPathname('/adminUserGroup/adminUserGroupsList'), {
      timeout: 30_000,
    });
    const menuResp = page.waitForResponse(getOnPathname('/adminCategory/getMenu'), {
      timeout: 30_000,
    });
    await page.goto('/system/roles', { waitUntil: 'domcontentloaded' });

    const rg = await groupsResp;
    expect(rg.status()).toBe(200);
    const bg = await rg.json();
    expect(bg.code).toBe(0);
    expect(Array.isArray(bg.data?.list)).toBeTruthy();

    const rm = await menuResp;
    expect(rm.status()).toBe(200);
    const bm = await rm.json();
    expect(bm.code).toBe(0);
    expect(Array.isArray(bm.data)).toBeTruthy();
    await expect(page).toHaveURL(/\/system\/roles/);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

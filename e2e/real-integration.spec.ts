import { expect, test } from '@playwright/test';
import { getOnPathname, login, postOnPathname } from './helpers/realIntegration';

/**
 * T01 第一轮联调（auth / operationInfo / room）真实浏览器验证。
 * 前置：samisWeb/.env.local 已启用 VITE_USE_REAL_AUTH/OPERATION_INFO/ROOM=true；
 *       vite 代理 target 指向本地 index 192.168.10.178:8022。
 * 运行：容器内 `node_modules/.bin/playwright test e2e/real-integration.spec.ts`。
 */

test.describe('T01 第一轮：auth / operationInfo / room 走真', () => {
  test('auth：登录拿到 JWT、跳工作台、顶栏显示真实用户', async ({ page }) => {
    const loginResp = page.waitForResponse(postOnPathname('/admin/login'));
    await login(page);

    const resp = await loginResp;
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.code).toBe(0);
    expect(body.data?.token).toBeTruthy();
    // JWT 形态校验（header.payload.signature，均以 eyJ 开头）
    expect(body.data.token.split('.').length).toBe(3);
    expect(body.data.token.startsWith('eyJ')).toBeTruthy();
    expect(body.data.userInfo?.name).toBe('质控管理员');

    // 跳转工作台
    await expect(page).toHaveURL(/\/workbench\/overview/);

    // token 写入 sessionStorage
    const token = await page.evaluate(() => sessionStorage.getItem('samis_token'));
    expect(token).toBeTruthy();
    expect(token!.startsWith('eyJ')).toBeTruthy();

    // 顶栏显示真实用户名
    await expect(page.getByText('质控管理员').first()).toBeVisible({ timeout: 10_000 });
  });

  test('operationInfo：排班页拉取真实手术列表（code:0 且非空）', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    const listResp = page.waitForResponse(getOnPathname('/operationInfo/getOperationList'));
    await page.goto('/surgery/schedule', { waitUntil: 'domcontentloaded' });
    const r = await listResp;
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.code).toBe(0);
    const rows = b.data?.list ?? b.data ?? [];
    expect(Array.isArray(rows)).toBeTruthy();
    expect(rows.length).toBeGreaterThan(0);
    await expect(page).toHaveURL(/\/surgery\/schedule/);
  });

  test('room：配置页拉取真实手术间列表（code:0 且非空）', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);

    const roomResp = page.waitForResponse(getOnPathname('/room/getRoomList'));
    await page.goto('/config/rooms', { waitUntil: 'domcontentloaded' });
    const r = await roomResp;
    expect(r.status()).toBe(200);
    const b = await r.json();
    expect(b.code).toBe(0);
    const rows = b.data?.list ?? b.data ?? [];
    expect(Array.isArray(rows)).toBeTruthy();
    expect(rows.length).toBeGreaterThan(0);
  });

  test('auth：清掉 token 访问受保护页 → 自动跳 /login', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workbench\/overview/);
    // 清空会话
    await page.evaluate(() => sessionStorage.clear());
    await page.goto('/surgery/schedule', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
  });
});

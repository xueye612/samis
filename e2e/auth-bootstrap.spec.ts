import { expect, test } from '@playwright/test';

const API_PREFIX = '/api-samis/pc/v1';
const protectedFragments = [
  '/operationInfo/', '/room/', '/anesthesiaRecord/', '/anesthesiaSync/',
  '/anesthesiaDevice/', '/anesthesiaDict/', '/pacu/', '/postoperative/',
  '/quality/', '/preoperative/', '/document/', '/clinicalDocument/',
  '/admin/', '/adminUser/', '/adminUserGroup/', '/adminCategory/', '/auth/', '/user/',
];

const e2eUsername = process.env.SAMIS_E2E_USERNAME;
const e2ePassword = process.env.SAMIS_E2E_PASSWORD;

function isProtectedApi(url: string): boolean {
  return url.includes(API_PREFIX) && protectedFragments.some((part) => url.includes(part));
}

test('login page sends no protected catalog requests before token exists', async ({ page }) => {
  const protectedRequests: string[] = [];
  page.on('request', (request) => {
    if (isProtectedApi(request.url())) protectedRequests.push(request.url());
  });

  await page.goto('/login');
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  await page.waitForTimeout(1_000);

  expect(protectedRequests).toEqual([]);
  await expect(page.getByText('Token缺失')).toHaveCount(0);
});

test('concurrent auth failures produce one warning and one login transition', async ({ page }) => {
  let failedProtectedRequests = 0;
  let releaseConcurrentFailures: (() => void) | undefined;
  const concurrentFailureGate = new Promise<void>((resolve) => {
    releaseConcurrentFailures = resolve;
  });

  await page.addInitScript(() => {
    sessionStorage.setItem('samis_token', 'expired-e2e-token');
    sessionStorage.setItem('samis_authorization', 'Bearer expired-e2e-token');
    sessionStorage.setItem('samis_room', 'OR-01');
    sessionStorage.setItem('samis_room_group', 'ANES');
    sessionStorage.setItem('samis_user_profile', JSON.stringify({
      userId: 'auth-e2e-user',
      loginName: 'auth-e2e-user',
      displayName: '鉴权验收用户',
    }));

    const marker = { loginTransitions: 0 };
    (window as unknown as { __authE2E: typeof marker }).__authE2E = marker;
    for (const method of ['pushState', 'replaceState'] as const) {
      const original = history[method].bind(history);
      Object.defineProperty(history, method, {
        configurable: true,
        value: (state: unknown, unused: string, url?: string | URL | null) => {
          if (url !== undefined && url !== null) {
            const next = new URL(String(url), location.href);
            if (next.pathname === '/login') marker.loginTransitions += 1;
          }
          return original(state, unused, url);
        },
      });
    }
  });

  await page.route('**/api-samis/pc/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/adminUser/getAdminUserInfo')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          msg: 'ok',
          data: {
            userId: 'auth-e2e-user',
            userName: '鉴权验收用户',
            loginName: 'auth-e2e-user',
            room: 'OR-01',
            roomGroup: 'ANES',
          },
        }),
      });
      return;
    }

    failedProtectedRequests += 1;
    if (failedProtectedRequests === 2) releaseConcurrentFailures?.();
    await concurrentFailureGate;
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 9001, msg: 'Token缺失', data: null }),
    });
  });

  await page.goto('/workbench/overview');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);

  expect(failedProtectedRequests).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.arco-message').filter({ hasText: /^Token缺失$/ })).toHaveCount(1);
  const loginTransitions = await page.evaluate(() => (
    window as unknown as { __authE2E: { loginTransitions: number } }
  ).__authE2E.loginTransitions);
  expect(loginTransitions).toBe(1);
});

test('authenticated bootstrap sends a protected request with auth headers', async ({ page }) => {
  test.skip(!e2eUsername || !e2ePassword, 'requires SAMIS_E2E_USERNAME and SAMIS_E2E_PASSWORD');

  await page.goto('/login');
  await page.locator('input').first().fill(e2eUsername!);
  await page.locator('input[type="password"]').fill(e2ePassword!);
  const protectedRequestPromise = page.waitForRequest((request) => (
    request.method() === 'GET' && request.url().includes('/operationInfo/getOperationList')
  ));
  await page.getByRole('button', { name: '登录' }).click();

  const protectedRequest = await protectedRequestPromise;
  const headers = protectedRequest.headers();
  expect(Boolean(headers.token || headers.authorization)).toBe(true);
  await expect(page).toHaveURL(/\/workbench\/overview/);
});

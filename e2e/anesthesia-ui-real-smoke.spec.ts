import { expect, test } from '@playwright/test';

/**
 * 麻醉记录浏览器 UI 真实闭环冒烟。
 *
 * 默认跳过：不登录、不写库。
 * 真实运行必须显式 opt-in：
 *   VITE_SAMIS_REAL_INTEGRATION=1
 *   VITE_USE_REAL_ANESTHESIA_RECORD=true
 *   VITE_USE_REAL_ANESTHESIA_SYNC=true
 *   VITE_USE_REAL_AUTH=true
 *   VITE_SAMIS_API_BASE=http://192.168.10.178:8022/api-samis/pc/v1
 */

const env = process.env;
const REAL_INTEGRATION = env.VITE_SAMIS_REAL_INTEGRATION === '1' || env.SAMIS_REAL_INTEGRATION === '1';
const REAL_RECORD = env.VITE_USE_REAL_ANESTHESIA_RECORD === 'true';
const REAL_SYNC = env.VITE_USE_REAL_ANESTHESIA_SYNC === 'true';
const REAL_AUTH = env.VITE_USE_REAL_AUTH === 'true';
const SHOULD_RUN_REAL = REAL_INTEGRATION && REAL_RECORD && REAL_SYNC && REAL_AUTH;

test.describe('anesthesia UI real smoke', () => {
  test.skip(!SHOULD_RUN_REAL, 'explicit real integration opt-in is required; default mode must not login or write data');

  test('opt-in skeleton is gated before any real UI writes', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
  });
});

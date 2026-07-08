import { type Page, type Response } from '@playwright/test';

/**
 * 真实联调 e2e 共用工具：登录 + 带前缀守卫的响应 matcher。
 *
 * 为何要 /api-samis/ 前缀守卫：页面导航 GET（如 GET /pacu/list 返回 index.html）
 * 会与同后缀 API（GET /api-samis/pc/v1/pacu/list）都以 /pacu/list 结尾而误匹配，
 * 导致 waitForResponse 捕获到 HTML、r.json() 解析失败（round 4 早期 PACU 坑）。
 * 故所有 matcher 必须先校验 url 含 /api-samis/ 再比 pathname 后缀。
 *
 * 账号默认读环境变量 SAMIS_E2E_USERNAME / SAMIS_E2E_PASSWORD，缺省回退测试种子账号。
 */

const DEFAULT_USERNAME = 'quality_admin';
const DEFAULT_PASSWORD = 'samis2026';

/**
 * 读取可选环境变量覆盖（不依赖 @types/node：经 globalThis 取 process.env）。
 * SAMIS_E2E_USERNAME / SAMIS_E2E_PASSWORD 缺省回退上面的测试种子账号。
 */
function envOverride(key: string): string | undefined {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.[key];
}

/** 安全取 pathname：解析失败回退到原始 url（与历史实现一致）。 */
function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** 是否带 /api-samis/ 前缀的 API 响应（排除页面导航 HTML）。 */
function isApiSamisResponse(url: string): boolean {
  return url.includes('/api-samis/');
}

/** 登录：填首输入框 + 密码框 + 点「登录」。 */
export async function login(
  page: Page,
  username: string = envOverride('SAMIS_E2E_USERNAME') ?? DEFAULT_USERNAME,
  password: string = envOverride('SAMIS_E2E_PASSWORD') ?? DEFAULT_PASSWORD,
): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input').first().fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
}

/** 命中指定 API pathname 后缀的 GET 响应（带 /api-samis/ 前缀守卫）。 */
export function getOnPathname(pathSuffix: string): (r: Response) => boolean {
  return (r) => {
    const url = r.url();
    if (!isApiSamisResponse(url)) return false;
    return pathnameOf(url).endsWith(pathSuffix) && r.request().method() === 'GET';
  };
}

/** 命中指定 API pathname 后缀的 POST 响应（带 /api-samis/ 前缀守卫）。 */
export function postOnPathname(pathSuffix: string): (r: Response) => boolean {
  return (r) => {
    const url = r.url();
    if (!isApiSamisResponse(url)) return false;
    return pathnameOf(url).endsWith(pathSuffix) && r.request().method() === 'POST';
  };
}

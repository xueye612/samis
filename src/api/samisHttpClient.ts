import {
  SAMIS_API_BASE,
  SAMIS_REQUEST_TIMEOUT_MS,
} from '@/config/apiFlags';
import type { SamisApiResponse } from '@/api/samisResponse';
import {
  isSamisAuthBusinessCode,
  readSamisResponseMessage,
  unwrapSamisResponse,
} from '@/api/samisResponse';
import { buildSamisRequestHeaders, clearSamisSession } from '@/services/session/samisSession';

const SAMIS_PREFIX = '/api-samis/pc/v1';

export class SamisHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: number,
    readonly isAuthError = false,
    readonly isNetworkError = false,
  ) {
    super(message);
    this.name = 'SamisHttpError';
  }
}

/** Normalize path: strip duplicate /api-samis/pc/v1 segments */
export function normalizeSamisPath(path: string): string {
  let p = path.trim();
  if (!p.startsWith('/')) p = `/${p}`;
  const dup = /\/api-samis\/pc\/v1/gi;
  while (dup.test(p)) {
    p = p.replace(dup, '');
  }
  if (!p.startsWith('/')) p = `/${p}`;
  return p;
}

export function joinSamisUrl(base: string, path: string): string {
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = normalizeSamisPath(path);
  if (normalizedBase.endsWith('/api-samis/pc/v1') && normalizedPath.startsWith(SAMIS_PREFIX)) {
    return `${normalizedBase}${normalizedPath.slice(SAMIS_PREFIX.length)}`;
  }
  return `${normalizedBase}${normalizedPath}`;
}

let authRedirectPending = false;

async function handleAuthFailure(message: string) {
  clearSamisSession();
  if (authRedirectPending || typeof window === 'undefined') return;
  authRedirectPending = true;
  try {
    const { Message } = await import('@arco-design/web-vue');
    Message.warning(message || '登录已失效，请重新登录');
  } catch {
    // ignore
  }
  const { default: router } = await import('@/router');
  const current = router.currentRoute.value;
  if (current.path !== '/login') {
    await router.replace({
      path: '/login',
      query: { redirect: current.fullPath },
    });
  }
  authRedirectPending = false;
}

export async function samisHttpFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = joinSamisUrl(SAMIS_API_BASE, path);
  const headers = buildSamisRequestHeaders(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SAMIS_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SamisHttpError('请求超时', undefined, undefined, false, true);
    }
    throw new SamisHttpError(
      error instanceof Error ? error.message : '网络请求失败',
      undefined,
      undefined,
      false,
      true,
    );
  } finally {
    clearTimeout(timeout);
  }

  let body: SamisApiResponse<T> | null = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text) as SamisApiResponse<T>;
    } catch {
      throw new SamisHttpError(`响应解析失败 (${response.status})`, response.status);
    }
  }

  if (!response.ok) {
    const isAuth = response.status === 401
      || response.status === 403
      || isSamisAuthBusinessCode(body?.code);
    const msg = readSamisResponseMessage(body, `HTTP ${response.status}`);
    if (isAuth) await handleAuthFailure(msg);
    throw new SamisHttpError(msg, response.status, body?.code, isAuth);
  }

  if (!body) {
    throw new SamisHttpError('空响应', response.status);
  }

  if (body.code !== 0) {
    const msg = readSamisResponseMessage(body);
    const isAuth = isSamisAuthBusinessCode(body.code);
    if (isAuth) await handleAuthFailure(msg);
    throw new SamisHttpError(msg, response.status, body.code, isAuth);
  }

  return unwrapSamisResponse(body);
}

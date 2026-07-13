export interface SamisApiResponse<T = unknown> {
  code: number;
  msg?: string;
  /** 部分 SAMIS 接口使用 message 而非 msg */
  message?: string;
  data: T;
  request_id?: string;
}

/** 业务层 token/鉴权失败（HTTP 可能仍为 200 或 400 包装） */
export function isSamisAuthBusinessCode(code: number | undefined): boolean {
  if (code === undefined || !Number.isFinite(code)) return false;
  return code === 401 || code === 403 || code === 9001 || code === 9003;
}

export function readSamisResponseMessage(
  body: Pick<SamisApiResponse<unknown>, 'msg' | 'message'> | null | undefined,
  fallback = '接口返回失败',
): string {
  if (!body) return fallback;
  return (body.msg || body.message || fallback).trim() || fallback;
}

export { ANESTHESIA_USE_MOCK } from '@/config/apiFlags';

export function unwrapSamisResponse<T>(response: SamisApiResponse<T>): T {
  if (response.code !== 0) {
    throw new Error(response.msg || '接口返回失败');
  }
  return response.data;
}

export function buildSamisSuccess<T>(data: T, msg = 'success'): SamisApiResponse<T> {
  return {
    code: 0,
    msg,
    data,
    request_id: `mock-${Date.now()}`,
  };
}

export function buildSamisError(msg: string, code = 1): SamisApiResponse<null> {
  return {
    code,
    msg,
    data: null,
    request_id: `mock-${Date.now()}`,
  };
}

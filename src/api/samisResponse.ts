export interface SamisApiResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
  request_id?: string;
}

export const ANESTHESIA_USE_MOCK = import.meta.env.VITE_ANESTHESIA_USE_MOCK !== 'false';

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

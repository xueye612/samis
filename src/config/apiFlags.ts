import { isRealModule, resolveApiMode } from './apiMode';
import type { SamisApiModule } from './apiMode';

export type { SamisApiModule };

const API_MODE = resolveApiMode(import.meta.env as unknown as Record<string, string | undefined>);

/** Legacy global mock; when false, all modules prefer real HTTP unless overridden */
export const ANESTHESIA_USE_MOCK = API_MODE.mockEnabled;

export const SAMIS_API_BASE = (
  import.meta.env.VITE_SAMIS_API_BASE as string | undefined
)?.replace(/\/+$/, '') || '/api-samis/pc/v1';

export const SAMIS_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_SAMIS_REQUEST_TIMEOUT_MS) || 30000;

export const AUTH_LOGIN_BYPASS = API_MODE.loginBypass;

export function useRealAuth(): boolean {
  return isRealModule(API_MODE, 'auth');
}

export function useRealOperationInfo(): boolean {
  return isRealModule(API_MODE, 'operationInfo');
}

export function useRealRoom(): boolean {
  return isRealModule(API_MODE, 'room');
}

export function useRealAnesthesiaRecord(): boolean {
  return isRealModule(API_MODE, 'anesthesiaRecord');
}

export function useRealAnesthesiaSync(): boolean {
  return isRealModule(API_MODE, 'anesthesiaSync');
}

export function useRealDevice(): boolean {
  return isRealModule(API_MODE, 'anesthesiaDevice');
}

export function useRealAnesthesiaDict(): boolean {
  return isRealModule(API_MODE, 'anesthesiaDict');
}

export function useRealPacu(): boolean {
  return isRealModule(API_MODE, 'pacu');
}

export function useRealPostoperative(): boolean {
  return isRealModule(API_MODE, 'postoperative');
}

export function useRealQuality(): boolean {
  return isRealModule(API_MODE, 'quality');
}

export function useRealPreoperative(): boolean {
  return isRealModule(API_MODE, 'preoperative');
}

export function useRealAdmin(): boolean {
  return isRealModule(API_MODE, 'admin');
}

export function resolveSamisModule(path: string): SamisApiModule {
  const normalized = path.replace(/.*\/api-samis\/pc\/v1/, '');
  if (normalized.includes('/adminUser/') || normalized.includes('/adminUserGroup/') || normalized.includes('/adminCategory/')) return 'admin';
  if (/\/(login|auth|user|admin)\//i.test(normalized) || normalized.startsWith('/login')) return 'auth';
  if (normalized.includes('/operationInfo/')) return 'operationInfo';
  if (normalized.includes('/room/')) return 'room';
  if (normalized.includes('/anesthesiaRecord/')) return 'anesthesiaRecord';
  if (normalized.includes('/anesthesiaSync/')) return 'anesthesiaSync';
  if (normalized.includes('/anesthesiaDevice/')) return 'anesthesiaDevice';
  if (normalized.includes('/anesthesiaDict/')) return 'anesthesiaDict';
  if (normalized.includes('/pacu/')) return 'pacu';
  if (normalized.includes('/postoperative/')) return 'postoperative';
  if (normalized.includes('/quality/')) return 'quality';
  if (normalized.includes('/preoperative/')) return 'preoperative';
  if (normalized.includes('/document/') || normalized.includes('/clinicalDocument/')) return 'document';
  return 'legacy';
}

export function useRealForModule(module: SamisApiModule): boolean {
  return isRealModule(API_MODE, module);
}

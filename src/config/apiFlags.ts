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

/**
 * 手术间设备配置专用 mock 开关（默认关闭）。
 *
 * 该功能（房间列表 + HULI 设备候选）默认必须直连真实后端，读取 HULI operation_room
 * 与 physical_equipment。即使全局 VITE_ANESTHESIA_USE_MOCK=true 且
 * VITE_USE_REAL_DEVICE=false，本功能仍走真实后端，避免静默回退到内置 1/2/3 号 mock 房间。
 *
 * 仅在自动化测试或显式设置 VITE_ROOM_DEVICE_MOCK_ENABLED=true 时启用 mock。
 */
export function useRoomDeviceMock(): boolean {
  const flag = (import.meta.env.VITE_ROOM_DEVICE_MOCK_ENABLED as string | undefined) ?? '';
  return flag === 'true' || flag === '1';
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

/** Parse env boolean: only explicit "false" is false when default true */
function envTrue(key: string, defaultValue = true): boolean {
  const raw = import.meta.env[key];
  if (raw === undefined || raw === '') return defaultValue;
  return raw !== 'false' && raw !== '0';
}

/** Legacy global mock; when false, all modules prefer real HTTP unless overridden */
export const ANESTHESIA_USE_MOCK = import.meta.env.VITE_ANESTHESIA_USE_MOCK !== 'false';

export const SAMIS_API_BASE = (
  import.meta.env.VITE_SAMIS_API_BASE as string | undefined
)?.replace(/\/+$/, '') || '/api-samis/pc/v1';

export const SAMIS_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_SAMIS_REQUEST_TIMEOUT_MS) || 30000;

export const AUTH_LOGIN_BYPASS = import.meta.env.VITE_AUTH_LOGIN_BYPASS === 'true';

export function useRealAuth(): boolean {
  if (!ANESTHESIA_USE_MOCK) return true;
  return envTrue('VITE_USE_REAL_AUTH', false);
}

export function useRealOperationInfo(): boolean {
  if (!ANESTHESIA_USE_MOCK) return true;
  return envTrue('VITE_USE_REAL_OPERATION_INFO', false);
}

export function useRealRoom(): boolean {
  if (!ANESTHESIA_USE_MOCK) return true;
  return envTrue('VITE_USE_REAL_ROOM', false);
}

export function useRealAnesthesiaRecord(): boolean {
  if (!ANESTHESIA_USE_MOCK) return false;
  return envTrue('VITE_USE_REAL_ANESTHESIA_RECORD', false);
}

export function useRealAnesthesiaSync(): boolean {
  if (!ANESTHESIA_USE_MOCK) return false;
  return envTrue('VITE_USE_REAL_ANESTHESIA_SYNC', false);
}

export function useRealDevice(): boolean {
  if (!ANESTHESIA_USE_MOCK) return false;
  return envTrue('VITE_USE_REAL_DEVICE', false);
}

export function useRealAnesthesiaDict(): boolean {
  if (!ANESTHESIA_USE_MOCK) return true;
  return envTrue('VITE_USE_REAL_ANESTHESIA_DICT', false);
}

/**
 * PACU 恢复记录（Slice 4）：独立 REST CRUD，默认 mock。
 * 与记录单域（pushBatch 本地优先）不同，PACU 页面直连接口。
 */
export function useRealPacu(): boolean {
  if (!ANESTHESIA_USE_MOCK) return false;
  return envTrue('VITE_USE_REAL_PACU', false);
}

/**
 * 术后管理（Slice 5）：术后随访/并发症 CRUD + 镇痛/非计划病例聚合。
 * 独立 REST CRUD（同 PACU 风格），默认 mock。
 */
export function useRealPostoperative(): boolean {
  if (!ANESTHESIA_USE_MOCK) return false;
  return envTrue('VITE_USE_REAL_POSTOPERATIVE', false);
}

/**
 * 质控 26 指标（Slice 6a）：服务端权威计算（indicators/indicatorDetail/report）。
 * 默认 mock（前端 qualityCalculator 兜底）；VITE_USE_REAL_QUALITY=true 切服务端。
 */
export function useRealQuality(): boolean {
  if (!ANESTHESIA_USE_MOCK) return false;
  return envTrue('VITE_USE_REAL_QUALITY', false);
}

/**
 * 术前管理（Slice 7）：申请接收/会诊/检查/知情同意/安全核查 CRUD。
 * 独立 REST CRUD（同 PACU/术后 风格），默认 mock。
 */
export function useRealPreoperative(): boolean {
  if (!ANESTHESIA_USE_MOCK) return false;
  return envTrue('VITE_USE_REAL_PREOPERATIVE', false);
}

/**
 * 系统管理（T04/T05）：用户/角色/菜单管理消费已有后端。
 * opt-in，默认 false（SystemUsers/SystemRoles 回本地 seed/静态）。
 */
export function useRealAdmin(): boolean {
  if (!ANESTHESIA_USE_MOCK) return false;
  return envTrue('VITE_USE_REAL_ADMIN', false);
}

export type SamisApiModule =
  | 'auth'
  | 'operationInfo'
  | 'room'
  | 'anesthesiaRecord'
  | 'anesthesiaSync'
  | 'anesthesiaDevice'
  | 'anesthesiaDict'
  | 'pacu'
  | 'postoperative'
  | 'quality'
  | 'preoperative'
  | 'admin'
  | 'legacy';

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
  return 'legacy';
}

export function useRealForModule(module: SamisApiModule): boolean {
  switch (module) {
    case 'auth':
      return useRealAuth();
    case 'operationInfo':
      return useRealOperationInfo();
    case 'room':
      return useRealRoom();
    case 'anesthesiaRecord':
      return useRealAnesthesiaRecord();
    case 'anesthesiaSync':
      return useRealAnesthesiaSync();
    case 'anesthesiaDevice':
      return useRealDevice();
    case 'anesthesiaDict':
      return useRealAnesthesiaDict();
    case 'pacu':
      return useRealPacu();
    case 'postoperative':
      return useRealPostoperative();
    case 'quality':
      return useRealQuality();
    case 'preoperative':
      return useRealPreoperative();
    case 'admin':
      return useRealAdmin();
    case 'legacy':
      return false;
    default:
      return false;
  }
}

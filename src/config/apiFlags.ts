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

export type SamisApiModule =
  | 'auth'
  | 'operationInfo'
  | 'room'
  | 'anesthesiaRecord'
  | 'anesthesiaSync'
  | 'anesthesiaDevice'
  | 'anesthesiaDict'
  | 'legacy';

export function resolveSamisModule(path: string): SamisApiModule {
  const normalized = path.replace(/.*\/api-samis\/pc\/v1/, '');
  if (/\/(login|auth|user|admin)\//i.test(normalized) || normalized.startsWith('/login')) return 'auth';
  if (normalized.includes('/operationInfo/')) return 'operationInfo';
  if (normalized.includes('/room/')) return 'room';
  if (normalized.includes('/anesthesiaRecord/')) return 'anesthesiaRecord';
  if (normalized.includes('/anesthesiaSync/')) return 'anesthesiaSync';
  if (normalized.includes('/anesthesiaDevice/')) return 'anesthesiaDevice';
  if (normalized.includes('/anesthesiaDict/')) return 'anesthesiaDict';
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
    case 'legacy':
      return false;
    default:
      return false;
  }
}

export type SamisApiModule =
  | 'auth' | 'operationInfo' | 'room' | 'anesthesiaRecord' | 'anesthesiaSync'
  | 'anesthesiaDevice' | 'anesthesiaDict' | 'pacu' | 'postoperative'
  | 'quality' | 'preoperative' | 'document' | 'admin' | 'legacy';

export interface ApiModeConfig {
  mockEnabled: boolean;
  loginBypass: boolean;
  realModules: ReadonlySet<SamisApiModule>;
}

const supportedRealModules: readonly SamisApiModule[] = [
  'auth', 'operationInfo', 'room', 'anesthesiaRecord', 'anesthesiaSync',
  'anesthesiaDevice', 'anesthesiaDict', 'pacu', 'postoperative',
  'quality', 'preoperative', 'document', 'admin',
];

const envKeys: Partial<Record<SamisApiModule, string>> = {
  auth: 'VITE_USE_REAL_AUTH', operationInfo: 'VITE_USE_REAL_OPERATION_INFO',
  room: 'VITE_USE_REAL_ROOM', anesthesiaRecord: 'VITE_USE_REAL_ANESTHESIA_RECORD',
  anesthesiaSync: 'VITE_USE_REAL_ANESTHESIA_SYNC', anesthesiaDevice: 'VITE_USE_REAL_DEVICE',
  anesthesiaDict: 'VITE_USE_REAL_ANESTHESIA_DICT', pacu: 'VITE_USE_REAL_PACU',
  postoperative: 'VITE_USE_REAL_POSTOPERATIVE', quality: 'VITE_USE_REAL_QUALITY',
  preoperative: 'VITE_USE_REAL_PREOPERATIVE', document: 'VITE_USE_REAL_DOCUMENT',
  admin: 'VITE_USE_REAL_ADMIN',
};

const enabled = (value: string | undefined) => value === 'true' || value === '1';

export function resolveApiMode(env: Record<string, string | undefined>): ApiModeConfig {
  const mockEnabled = env.VITE_ANESTHESIA_USE_MOCK !== 'false';
  const realModules = new Set<SamisApiModule>();
  for (const module of supportedRealModules) {
    if (!mockEnabled || enabled(env[envKeys[module] ?? ''])) realModules.add(module);
  }
  return { mockEnabled, loginBypass: enabled(env.VITE_AUTH_LOGIN_BYPASS), realModules };
}

export function isRealModule(config: ApiModeConfig, module: SamisApiModule): boolean {
  return module !== 'legacy' && config.realModules.has(module);
}

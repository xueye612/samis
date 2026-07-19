export type DeviceSimulationMode = 'normal' | 'abnormal' | 'rescue';

export type AbnormalSimulationType =
  | 'hypotension'
  | 'hypertension'
  | 'tachycardia'
  | 'hypoxia'
  | 'etco2';

export const DEVICE_SIMULATION_MODE_STORAGE_KEY = 'samis.anesthesia.deviceSimulationMode';
export const ABNORMAL_SIMULATION_TYPES_STORAGE_KEY = 'samis.anesthesia.abnormalSimulationTypes';
export const DEVICE_RAW_INTERVAL_SECONDS_STORAGE_KEY = 'samis.anesthesia.deviceRawIntervalSeconds';

export const ABNORMAL_SIMULATION_OPTIONS: Array<{ value: AbnormalSimulationType; label: string }> = [
  { value: 'hypotension', label: '低血压' },
  { value: 'hypertension', label: '高血压' },
  { value: 'tachycardia', label: '心率过快' },
  { value: 'hypoxia', label: '血氧下降' },
  { value: 'etco2', label: 'EtCO2 异常' },
];

export const DEFAULT_ABNORMAL_SIMULATION_TYPES: AbnormalSimulationType[] = [
  'hypotension',
  'hypoxia',
];

const DEFAULT_MODE: DeviceSimulationMode = 'normal';
const DEFAULT_RAW_SECONDS = 5;
const RESCUE_RAW_MS = 2000;

export function clampDeviceRawIntervalSeconds(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_RAW_SECONDS;
  return Math.max(2, Math.min(30, Math.round(Number(value))));
}

export function readDeviceRawIntervalSeconds(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_RAW_SECONDS;
  const stored = localStorage.getItem(DEVICE_RAW_INTERVAL_SECONDS_STORAGE_KEY);
  if (stored === null || stored === '') return DEFAULT_RAW_SECONDS;
  return clampDeviceRawIntervalSeconds(Number(stored));
}

export function writeDeviceRawIntervalSeconds(value: number): number {
  const normalized = clampDeviceRawIntervalSeconds(value);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DEVICE_RAW_INTERVAL_SECONDS_STORAGE_KEY, String(normalized));
  }
  return normalized;
}

export function readDeviceSimulationMode(): DeviceSimulationMode {
  if (typeof localStorage === 'undefined') return DEFAULT_MODE;
  const value = localStorage.getItem(DEVICE_SIMULATION_MODE_STORAGE_KEY);
  return value === 'abnormal' || value === 'rescue' ? value : 'normal';
}

export function writeDeviceSimulationMode(mode: DeviceSimulationMode) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DEVICE_SIMULATION_MODE_STORAGE_KEY, mode);
}

export function readAbnormalSimulationTypes(): AbnormalSimulationType[] {
  if (typeof localStorage === 'undefined') return [...DEFAULT_ABNORMAL_SIMULATION_TYPES];
  try {
    const parsed = JSON.parse(localStorage.getItem(ABNORMAL_SIMULATION_TYPES_STORAGE_KEY) ?? '[]') as AbnormalSimulationType[];
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_ABNORMAL_SIMULATION_TYPES];
    return parsed.filter((item) => ABNORMAL_SIMULATION_OPTIONS.some((option) => option.value === item));
  } catch {
    return [...DEFAULT_ABNORMAL_SIMULATION_TYPES];
  }
}

export function writeAbnormalSimulationTypes(types: AbnormalSimulationType[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(ABNORMAL_SIMULATION_TYPES_STORAGE_KEY, JSON.stringify(types));
}

export function resolveDeviceRawIntervalMs(
  mode: DeviceSimulationMode,
  configuredSeconds = readDeviceRawIntervalSeconds(),
): number {
  return mode === 'rescue' ? RESCUE_RAW_MS : clampDeviceRawIntervalSeconds(configuredSeconds) * 1000;
}

export function isRescueDeviceSimulation(mode: DeviceSimulationMode): boolean {
  return mode === 'rescue';
}

export function shouldForceAbnormalSample(mode: DeviceSimulationMode): boolean {
  return mode === 'abnormal';
}

export function pickAbnormalSimulationType(
  types: AbnormalSimulationType[] = readAbnormalSimulationTypes(),
): AbnormalSimulationType {
  const pool = types.length ? types : DEFAULT_ABNORMAL_SIMULATION_TYPES;
  return pool[Math.floor(Math.random() * pool.length)];
}

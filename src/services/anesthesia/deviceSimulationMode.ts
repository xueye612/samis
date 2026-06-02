export type DeviceSimulationMode = 'normal' | 'abnormal' | 'rescue';

export type AbnormalSimulationType =
  | 'hypotension'
  | 'hypertension'
  | 'tachycardia'
  | 'hypoxia'
  | 'etco2';

export const DEVICE_SIMULATION_MODE_STORAGE_KEY = 'samis.anesthesia.deviceSimulationMode';
export const ABNORMAL_SIMULATION_TYPES_STORAGE_KEY = 'samis.anesthesia.abnormalSimulationTypes';

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
const DEFAULT_RAW_MS = 4000;
const RESCUE_RAW_MS = 2000;

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

export function resolveDeviceRawIntervalMs(mode: DeviceSimulationMode): number {
  return mode === 'rescue' ? RESCUE_RAW_MS : DEFAULT_RAW_MS;
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

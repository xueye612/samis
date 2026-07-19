import { configApi } from '@/api/clinicalExtensions';
import type { LatestDeviceDataApi } from '@/api/anesthesiaSync';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';
import type { LocalMonitorRawRow, LocalVentilatorRawRow } from '@/types/anesthesiaLocalDb';

export type DeviceRealtimeSource = 'simulation' | 'real';

export const DEVICE_REALTIME_SOURCE_CONFIG_KEY = 'device_realtime_data_source';
export const DEVICE_REALTIME_SOURCE_STORAGE_KEY = 'samis.anesthesia.deviceRealtimeDataSource';

/** 未取得后台配置前绝不自动产生模拟临床数据。 */
export function shouldAutoStartMonitorOnRecordStart(
  source: DeviceRealtimeSource,
  sourceReady: boolean,
): boolean {
  return sourceReady && source === 'simulation';
}

type SimulatedDeviceDataListener = (operationId: string) => void;
const simulatedDeviceDataListeners = new Set<SimulatedDeviceDataListener>();

export function subscribeSimulatedDeviceDataCollected(listener: SimulatedDeviceDataListener): () => void {
  simulatedDeviceDataListeners.add(listener);
  return () => simulatedDeviceDataListeners.delete(listener);
}

export function notifySimulatedDeviceDataCollected(operationId: string): void {
  simulatedDeviceDataListeners.forEach((listener) => listener(operationId));
}

function normalizeSource(value: unknown): DeviceRealtimeSource | null {
  return value === 'simulation' || value === 'real' ? value : null;
}

export function readCachedDeviceRealtimeSource(): DeviceRealtimeSource {
  // 未取得后台授权时必须按真实设备处理，避免模拟值被无意带入临床记录。
  if (typeof localStorage === 'undefined') return 'real';
  return normalizeSource(localStorage.getItem(DEVICE_REALTIME_SOURCE_STORAGE_KEY)) ?? 'real';
}

function cacheDeviceRealtimeSource(source: DeviceRealtimeSource) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DEVICE_REALTIME_SOURCE_STORAGE_KEY, source);
}

export async function loadDeviceRealtimeSource(): Promise<DeviceRealtimeSource> {
  const cached = readCachedDeviceRealtimeSource();
  try {
    const remote = await configApi.get(DEVICE_REALTIME_SOURCE_CONFIG_KEY, 'global');
    const source = normalizeSource(remote.value) ?? cached;
    cacheDeviceRealtimeSource(source);
    return source;
  } catch {
    return cached;
  }
}

export async function saveDeviceRealtimeSource(source: DeviceRealtimeSource): Promise<DeviceRealtimeSource> {
  const saved = await configApi.set(
    DEVICE_REALTIME_SOURCE_CONFIG_KEY,
    source,
    'global',
    '麻醉记录单实时设备数值来源：simulation=模拟采集，real=真实设备网关',
  );
  const normalized = normalizeSource(saved.value) ?? source;
  cacheDeviceRealtimeSource(normalized);
  return normalized;
}

function latestByCollectTime<T extends { collect_time: string }>(rows: T[]): T | null {
  if (!rows.length) return null;
  return rows.reduce((latest, current) => (
    String(current.collect_time) > String(latest.collect_time) ? current : latest
  ));
}

export function mapSimulatedDeviceRows(
  monitor: LocalMonitorRawRow | null,
  ventilator: LocalVentilatorRawRow | null,
): LatestDeviceDataApi {
  return {
    monitor: monitor ? {
      localId: monitor.local_id,
      operationId: monitor.operation_id,
      deviceId: monitor.device_id ?? null,
      sourceDevice: monitor.source_device ?? null,
      deviceType: 'monitor',
      collectTime: monitor.collect_time,
      hr: monitor.hr ?? null,
      pulse: monitor.pulse ?? null,
      sbp: monitor.sbp ?? null,
      dbp: monitor.dbp ?? null,
      mapValue: monitor.map_value ?? null,
      spo2: monitor.spo2 ?? null,
      temperature: monitor.temperature ?? null,
      respiration: monitor.respiration ?? null,
      bis: monitor.bis ?? null,
      etco2: monitor.etco2 ?? null,
    } : null,
    ventilator: ventilator ? {
      localId: ventilator.local_id,
      operationId: ventilator.operation_id,
      deviceId: ventilator.device_id ?? null,
      sourceDevice: ventilator.source_device ?? null,
      deviceType: 'ventilator',
      collectTime: ventilator.collect_time,
      ventMode: ventilator.vent_mode ?? null,
      tidalVolume: ventilator.tidal_volume ?? null,
      respiratoryRate: ventilator.respiratory_rate ?? null,
      fio2: ventilator.fio2 ?? null,
      peep: ventilator.peep ?? null,
      peakPressure: ventilator.peak_pressure ?? null,
      plateauPressure: ventilator.plateau_pressure ?? null,
      minuteVolume: ventilator.minute_volume ?? null,
      airwayPressure: ventilator.airway_pressure ?? null,
      etco2: ventilator.etco2 ?? null,
    } : null,
  };
}

export async function loadLatestSimulatedDeviceData(operationId: string): Promise<LatestDeviceDataApi> {
  const db = getAnesthesiaLocalDb();
  const [monitorRows, ventilatorRows] = await Promise.all([
    db.monitor_raw.where('operation_id').equals(operationId).toArray(),
    db.ventilator_raw.where('operation_id').equals(operationId).toArray(),
  ]);
  return mapSimulatedDeviceRows(latestByCollectTime(monitorRows), latestByCollectTime(ventilatorRows));
}

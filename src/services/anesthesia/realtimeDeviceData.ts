import { anesthesiaDeviceApi, type LatestDeviceDataApi, type LatestDeviceRawApi } from '@/api/anesthesiaSync';

export type DeviceFreshness = 'live' | 'delayed' | 'offline' | 'empty';

interface DeviceReadingBase {
  localId: string;
  operationId: string;
  deviceId: string | null;
  sourceDevice: string | null;
  collectTime: string | null;
}

export interface RealtimeMonitorReading extends DeviceReadingBase {
  hr: number | null;
  pulse: number | null;
  sbp: number | null;
  dbp: number | null;
  mapValue: number | null;
  spo2: number | null;
  temperature: number | null;
  respiration: number | null;
  bis: number | null;
  etco2: number | null;
}

export interface RealtimeVentilatorReading extends DeviceReadingBase {
  ventMode: string | null;
  tidalVolume: number | null;
  respiratoryRate: number | null;
  fio2: number | null;
  peep: number | null;
  peakPressure: number | null;
  plateauPressure: number | null;
  minuteVolume: number | null;
  airwayPressure: number | null;
  etco2: number | null;
}

export interface RealtimeDeviceData {
  monitor: RealtimeMonitorReading | null;
  ventilator: RealtimeVentilatorReading | null;
}

export interface RealtimeDeviceState {
  operationId: string;
  data: RealtimeDeviceData;
  freshness: DeviceFreshness;
  loading: boolean;
  error: string | null;
  polledAt: string | null;
}

const EMPTY_DATA: RealtimeDeviceData = { monitor: null, ventilator: null };
const LIVE_MAX_AGE_MS = 15_000;
const DELAYED_MAX_AGE_MS = 60_000;

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function base(raw: LatestDeviceRawApi): DeviceReadingBase {
  return {
    localId: String(raw.localId ?? ''),
    operationId: String(raw.operationId ?? ''),
    deviceId: nullableString(raw.deviceId),
    sourceDevice: nullableString(raw.sourceDevice),
    collectTime: nullableString(raw.collectTime),
  };
}

export function normalizeLatestDeviceData(input: Partial<LatestDeviceDataApi> | null | undefined): RealtimeDeviceData {
  const monitor = input?.monitor;
  const ventilator = input?.ventilator;
  return {
    monitor: monitor ? {
      ...base(monitor),
      hr: nullableNumber(monitor.hr),
      pulse: nullableNumber(monitor.pulse),
      sbp: nullableNumber(monitor.sbp),
      dbp: nullableNumber(monitor.dbp),
      mapValue: nullableNumber(monitor.mapValue),
      spo2: nullableNumber(monitor.spo2),
      temperature: nullableNumber(monitor.temperature),
      respiration: nullableNumber(monitor.respiration),
      bis: nullableNumber(monitor.bis),
      etco2: nullableNumber(monitor.etco2),
    } : null,
    ventilator: ventilator ? {
      ...base(ventilator),
      ventMode: nullableString(ventilator.ventMode),
      tidalVolume: nullableNumber(ventilator.tidalVolume),
      respiratoryRate: nullableNumber(ventilator.respiratoryRate),
      fio2: nullableNumber(ventilator.fio2),
      peep: nullableNumber(ventilator.peep),
      peakPressure: nullableNumber(ventilator.peakPressure),
      plateauPressure: nullableNumber(ventilator.plateauPressure),
      minuteVolume: nullableNumber(ventilator.minuteVolume),
      airwayPressure: nullableNumber(ventilator.airwayPressure),
      etco2: nullableNumber(ventilator.etco2),
    } : null,
  };
}

function parseHospitalTime(value: string | null): number | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(' ', 'T')}+08:00`
    : value;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function resolveDeviceFreshness(data: RealtimeDeviceData, now = Date.now()): DeviceFreshness {
  const timestamps = [data.monitor?.collectTime ?? null, data.ventilator?.collectTime ?? null]
    .map(parseHospitalTime)
    .filter((value): value is number => value !== null);
  if (!data.monitor && !data.ventilator) return 'empty';
  if (!timestamps.length) return 'offline';
  const age = Math.max(0, now - Math.max(...timestamps));
  if (age <= LIVE_MAX_AGE_MS) return 'live';
  if (age <= DELAYED_MAX_AGE_MS) return 'delayed';
  return 'offline';
}

export interface RealtimeDevicePollerOptions {
  operationId: string;
  intervalMs?: number;
  load?: (operationId: string) => Promise<LatestDeviceDataApi>;
  now?: () => number;
  onState: (state: RealtimeDeviceState) => void;
}

export interface RealtimeDevicePoller {
  start: () => void;
  refresh: () => Promise<void>;
  stop: () => void;
}

export function createRealtimeDevicePoller(options: RealtimeDevicePollerOptions): RealtimeDevicePoller {
  const intervalMs = Math.max(1_000, options.intervalMs ?? 3_000);
  const load = options.load ?? anesthesiaDeviceApi.getLatestDeviceData;
  const now = options.now ?? Date.now;
  let running = false;
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | null = null;
  let state: RealtimeDeviceState = {
    operationId: options.operationId,
    data: EMPTY_DATA,
    freshness: 'empty',
    loading: false,
    error: null,
    polledAt: null,
  };

  const emit = (next: RealtimeDeviceState) => {
    state = next;
    options.onState(next);
  };
  const schedule = () => {
    if (!running) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void refresh(); }, intervalMs);
  };
  const run = async () => {
    emit({ ...state, loading: true, error: null });
    try {
      const data = normalizeLatestDeviceData(await load(options.operationId));
      if (!active) return;
      emit({
        operationId: options.operationId,
        data,
        freshness: resolveDeviceFreshness(data, now()),
        loading: false,
        error: null,
        polledAt: new Date(now()).toISOString(),
      });
    } catch (error) {
      if (!active) return;
      emit({
        ...state,
        freshness: resolveDeviceFreshness(state.data, now()),
        loading: false,
        error: error instanceof Error ? error.message : '实时设备数据加载失败',
        polledAt: new Date(now()).toISOString(),
      });
    } finally {
      schedule();
    }
  };
  const refresh = () => {
    if (!active) return Promise.resolve();
    if (inFlight) return inFlight;
    inFlight = run().finally(() => { inFlight = null; });
    return inFlight;
  };
  return {
    start: () => {
      if (running) return;
      active = true;
      running = true;
      void refresh();
    },
    refresh,
    stop: () => {
      active = false;
      running = false;
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}

export function emptyRealtimeDeviceState(operationId = ''): RealtimeDeviceState {
  return {
    operationId,
    data: EMPTY_DATA,
    freshness: 'empty',
    loading: false,
    error: null,
    polledAt: null,
  };
}

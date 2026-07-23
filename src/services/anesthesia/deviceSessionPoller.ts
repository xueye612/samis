import {
  anesthesiaDeviceSessionApi,
  type DeviceMetric,
  type DeviceSample,
  type DeviceSessionBinding,
  type DeviceSessionResponse,
} from '@/api/anesthesiaDeviceSession';

/**
 * 设备采集会话轮询状态。
 * - latest：每次请求刷新的实时值；
 * - items：按 messageId 去重追加的增量点；
 * - roomChanged：手术间变化时不静默换设备，仅提示。
 */
export interface DeviceSessionState {
  operationId: string;
  binding: DeviceSessionBinding | null;
  source: string;
  status: string;
  latest: DeviceSample | null;
  items: DeviceSample[];
  nextCursor: string | null;
  roomChanged: boolean;
  bindingRoomCode: string | null;
  bindingRoomName: string | null;
  currentRoomCode: string | null;
  currentRoomName: string | null;
  waitingForPatientEntry: boolean;
  message: string | null;
  loading: boolean;
  ended: boolean;
  error: string | null;
  polledAt: string | null;
}

export interface DeviceSessionPollerOptions {
  operationId: string;
  intervalMs?: number;
  load?: (params: { operationId: string; cursor: string | null }) => Promise<DeviceSessionResponse>;
  now?: () => number;
  onState: (state: DeviceSessionState) => void;
}

export interface DeviceSessionPoller {
  start: () => void;
  refresh: () => Promise<void>;
  stop: () => void;
}

const TERMINAL_ERROR_CODES = new Set([4092, 4091]);

/** 运行时归一：后端返回的列表字段可能为 null/undefined/对象/非数组，统一成数组，避免 `incoming is not iterable`。 */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

/** 归一单条样本：metrics 非数组时置空，metadata 缺失时补空对象。 */
function normalizeSample(sample: unknown): DeviceSample | null {
  if (!sample || typeof sample !== 'object') return null;
  const raw = sample as Partial<DeviceSample> & { metrics?: unknown };
  return {
    messageId: String(raw.messageId ?? ''),
    observedAt: String(raw.observedAt ?? ''),
    receivedAt: String(raw.receivedAt ?? ''),
    minuteBucketAt: String(raw.minuteBucketAt ?? ''),
    fiveMinuteBucketAt: String(raw.fiveMinuteBucketAt ?? ''),
    metrics: asArray<DeviceMetric>(raw.metrics),
    metadata: (raw.metadata && typeof raw.metadata === 'object') ? raw.metadata : {},
  } as DeviceSample;
}

export function emptyDeviceSessionState(operationId = ''): DeviceSessionState {
  return {
    operationId,
    binding: null,
    source: '',
    status: '',
    latest: null,
    items: [],
    nextCursor: null,
    roomChanged: false,
    bindingRoomCode: null,
    bindingRoomName: null,
    currentRoomCode: null,
    currentRoomName: null,
    waitingForPatientEntry: false,
    message: null,
    loading: false,
    ended: false,
    error: null,
    polledAt: null,
  };
}

/** 按 messageId 去重合并增量 items（页面刷新/重新挂载后不重复追加）。纯函数便于单测。 */
export function mergeItems(existing: DeviceSample[], incoming: DeviceSample[]): DeviceSample[] {
  const incomingList = asArray<DeviceSample>(incoming);
  const seen = new Set(existing.map((item) => item.messageId));
  const merged = [...existing];
  for (const item of incomingList) {
    if (!seen.has(item.messageId)) {
      seen.add(item.messageId);
      merged.push(item);
    }
  }
  return merged;
}

/** 应用一次响应到状态（纯函数，便于单测）。 */
export function applySessionResponse(state: DeviceSessionState, res: DeviceSessionResponse, polledAt: string): DeviceSessionState {
  // 后端运行时 items/latest.metrics 可能为 null/对象/非数组，统一归一，避免遍历抛错。
  const rawItems = asArray<unknown>(res.items).map(normalizeSample).filter((item): item is DeviceSample => item !== null);
  const items = mergeItems(state.items, rawItems);
  const latest = normalizeSample(res.latest);
  return {
    ...state,
    operationId: res.operationId,
    binding: res.binding,
    source: res.device?.source ?? '',
    status: res.device?.status ?? res.status ?? '',
    latest,
    items,
    nextCursor: res.nextCursor,
    roomChanged: res.roomChanged,
    bindingRoomCode: res.bindingRoomCode,
    bindingRoomName: res.bindingRoomName,
    currentRoomCode: res.currentRoomCode,
    currentRoomName: res.currentRoomName,
    waitingForPatientEntry: res.waitingForPatientEntry === true,
    message: res.message ?? null,
    loading: false,
    ended: false,
    error: null,
    polledAt,
  };
}

/** 解析业务错误码（兼容 samisRequest 抛出的 {code,message} 形态）。 */
function extractErrorCode(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; status?: unknown };
    const code = e.code ?? e.status;
    if (typeof code === 'number') return code;
    if (typeof code === 'string' && /^\d+$/.test(code)) return Number(code);
  }
  return null;
}

export function createDeviceSessionPoller(options: DeviceSessionPollerOptions): DeviceSessionPoller {
  const intervalMs = Math.max(1_000, options.intervalMs ?? 3_000);
  const load = options.load ?? ((params) =>
    anesthesiaDeviceSessionApi.getLatestDeviceData({ operationId: params.operationId, cursor: params.cursor ?? undefined }));
  const now = options.now ?? Date.now;
  let running = false;
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | null = null;
  let state: DeviceSessionState = emptyDeviceSessionState(options.operationId);

  const emit = (next: DeviceSessionState) => {
    state = next;
    options.onState(next);
  };
  const schedule = () => {
    if (!running || state.ended) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void refresh(); }, intervalMs);
  };
  const run = async () => {
    emit({ ...state, loading: true, error: null });
    try {
      const res = await load({ operationId: options.operationId, cursor: state.nextCursor });
      if (!active) return;
      emit(applySessionResponse(state, res, new Date(now()).toISOString()));
    } catch (error) {
      if (!active) return;
      const code = extractErrorCode(error);
      const ended = code !== null && TERMINAL_ERROR_CODES.has(code);
      emit({
        ...state,
        loading: false,
        ended,
        error: error instanceof Error ? error.message : '设备数据加载失败',
        polledAt: new Date(now()).toISOString(),
      });
    } finally {
      schedule();
    }
  };
  const refresh = () => {
    if (!active || state.ended) return Promise.resolve();
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

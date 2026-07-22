import { ANESTHESIA_USE_MOCK, samisRequest } from '@/api/samisClient';

export interface PushBatchItem {
  entityType: string;
  operationId?: string;
  action?: string;
  clientVersion?: number;
  occurredAt?: string;
  operationType: string;
  localId: string;
  serverId?: number | null;
  baseSyncVersion: number;
  apiPath: string;
  payload: unknown;
}

export interface PushBatchRequest {
  batchNo: string;
  operationId: string;
  recordLocalId: string;
  recordServerId?: number | null;
  clientTime: string;
  items: PushBatchItem[];
}

export interface PushBatchResultItem {
  entityType: string;
  localId: string;
  serverId?: number | null;
  status: 'success' | 'failed' | 'conflict';
  message?: string;
  // 后端契约 §6.2 使用统一枚举名（version_conflict / server_locked / ...），
  // 前端 parseConflictTypeFromResult 负责映射到本地 SyncConflictType。
  conflictType?: string;
  serverSyncVersion?: number;
  serverPayload?: unknown;
}

export interface PushBatchResponse {
  batchNo: string;
  results: PushBatchResultItem[];
}

export interface SyncStatusResponse {
  pendingCount: number;
  lastSyncedAt?: string;
  online: boolean;
}

export interface BatchSaveResponse {
  results: PushBatchResultItem[];
}

export interface LatestDeviceRawApi {
  localId?: string;
  serverId?: string;
  operationId?: string;
  deviceId?: string | null;
  sourceDevice?: string | null;
  deviceType?: string | null;
  collectTime?: string | null;
  createdAt?: string | null;
  hr?: number | string | null;
  pulse?: number | string | null;
  sbp?: number | string | null;
  dbp?: number | string | null;
  mapValue?: number | string | null;
  spo2?: number | string | null;
  temperature?: number | string | null;
  respiration?: number | string | null;
  bis?: number | string | null;
  etco2?: number | string | null;
  ventMode?: string | null;
  tidalVolume?: number | string | null;
  respiratoryRate?: number | string | null;
  fio2?: number | string | null;
  peep?: number | string | null;
  peakPressure?: number | string | null;
  plateauPressure?: number | string | null;
  minuteVolume?: number | string | null;
  airwayPressure?: number | string | null;
}

export interface LatestDeviceDataApi {
  monitor: LatestDeviceRawApi | null;
  ventilator: LatestDeviceRawApi | null;
}

function postJson<T>(path: string, body: unknown) {
  return samisRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const anesthesiaSyncApi = {
  pushBatch(body: PushBatchRequest) {
    return postJson<PushBatchResponse>('/anesthesiaSync/pushBatch', body);
  },
  getSyncStatus(operationId: string) {
    return samisRequest<SyncStatusResponse>(`/anesthesiaSync/getSyncStatus?operationId=${encodeURIComponent(operationId)}`);
  },
  getPendingCount(operationId?: string) {
    const query = operationId ? `?operationId=${encodeURIComponent(operationId)}` : '';
    return samisRequest<{ pendingCount: number }>(`/anesthesiaSync/getPendingCount${query}`);
  },
  confirmBatch(batchNo: string) {
    return postJson<{ batchNo: string; confirmed: boolean }>('/anesthesiaSync/confirmBatch', { batchNo });
  },
  resolveConflict(body: unknown) {
    return postJson<{ conflictId: string; resolved: boolean; resolvedAt?: string }>('/anesthesiaSync/resolveConflict', body);
  },
};

export const anesthesiaRecordApi = {
  getRecordDetail(params: { operationId: string; recordLocalId?: string; recordServerId?: number }) {
    const query = new URLSearchParams({
      operationId: params.operationId,
      ...(params.recordLocalId ? { recordLocalId: params.recordLocalId } : {}),
      ...(params.recordServerId ? { recordServerId: String(params.recordServerId) } : {}),
    });
    return samisRequest<unknown>(`/anesthesiaRecord/getRecordDetail?${query.toString()}`);
  },
  getPrintSnapshot(params: { operationId: string }) {
    const query = new URLSearchParams({ operationId: params.operationId });
    return samisRequest<unknown>(`/anesthesiaRecord/getPrintSnapshot?${query.toString()}`);
  },
  saveRecord(body: unknown) {
    return postJson<{ localId: string; serverId?: number }>('/anesthesiaRecord/saveRecord', body);
  },
  saveSnapshot(body: unknown) {
    return postJson<{ serverId?: number }>('/anesthesiaRecord/saveSnapshot', body);
  },
  batchSaveTimelineEvents(body: unknown) {
    return postJson<BatchSaveResponse>('/anesthesiaRecord/batchSaveTimelineEvents', body);
  },
  batchSaveMedications(body: unknown) {
    return postJson<BatchSaveResponse>('/anesthesiaRecord/batchSaveMedications', body);
  },
  batchSaveFluids(body: unknown) {
    return postJson<BatchSaveResponse>('/anesthesiaRecord/batchSaveFluids', body);
  },
  batchSaveTransfusions(body: unknown) {
    return postJson<BatchSaveResponse>('/anesthesiaRecord/batchSaveTransfusions', body);
  },
  batchSaveVitalSigns(body: unknown) {
    return postJson<BatchSaveResponse>('/anesthesiaRecord/batchSaveVitalSigns', body);
  },
  lockRecord(body: unknown) {
    return postJson<{ locked: boolean; lockedAt?: string }>('/anesthesiaRecord/lockRecord', body);
  },
  voidRecord(body: unknown) {
    return postJson<{ voided: boolean; voidedAt?: string }>('/anesthesiaRecord/voidRecord', body);
  },
  saveIoRecord(body: unknown) {
    return postJson<{ localId: string; serverId?: number; savedAt?: string }>('/anesthesiaRecord/saveIoRecord', body);
  },
  saveLabResult(body: unknown) {
    return postJson<{ localId: string; serverId?: number; savedAt?: string }>('/anesthesiaRecord/saveLabResult', body);
  },
};

export const anesthesiaDeviceApi = {
  batchPushMonitorData(body: unknown) {
    return postJson<BatchSaveResponse>('/anesthesiaDevice/batchPushMonitorData', body);
  },
  batchPushVentilatorData(body: unknown) {
    return postJson<BatchSaveResponse>('/anesthesiaDevice/batchPushVentilatorData', body);
  },
  getLatestDeviceData(operationId: string) {
    // 后端已升级为统一采集会话契约（binding/latest/items）。
    // 此处向后兼容：将统一响应映射为既有 {monitor, ventilator} 形态，
    // 使既有实时设备面板在真实数据源路径下仍可展示呼吸机预览数据，避免静默空数据。
    return samisRequest<LatestDeviceDataApi>(`/anesthesiaDevice/getLatestDeviceData?operationId=${encodeURIComponent(operationId)}`)
      .then((res) => mapUnifiedToDeviceData(res));
  },
};

// 运行时检测：后端统一契约字段存在时做映射，否则原样返回（兼容旧端点/模拟数据）。
function mapUnifiedToDeviceData(res: any): LatestDeviceDataApi {
  if (!res || typeof res !== 'object') return { monitor: null, ventilator: null };
  // 已是旧形态直接返回。
  if ('monitor' in res || 'ventilator' in res) return res as LatestDeviceDataApi;
  const latest = res.latest ?? null;
  if (!latest) return { monitor: null, ventilator: null };
  const metric = (code: string): number | null => {
    const m = (latest.metrics as Array<{ code: string; value: number }> | undefined)?.find((x) => x.code === code);
    return m ? m.value : null;
  };
  const ventilator: LatestDeviceRawApi = {
    localId: latest.messageId ?? '',
    operationId: res.operationId ?? '',
    deviceId: res.binding?.deviceCode ?? null,
    sourceDevice: res.binding?.deviceCode ?? null,
    deviceType: 'ventilator',
    collectTime: latest.observedAt ?? null,
    ventMode: latest.metadata?.ventMode ?? null,
    tidalVolume: metric('Vt'),
    respiratoryRate: metric('RR'),
    fio2: metric('FiO2'),
    peep: metric('PEEP'),
    peakPressure: metric('Ppeak'),
    plateauPressure: metric('Pplat'),
    minuteVolume: metric('MV'),
    airwayPressure: metric('Paw'),
    etco2: metric('EtCO2'),
  };
  return { monitor: null, ventilator };
}

export { ANESTHESIA_USE_MOCK, samisRequest } from '@/api/samisClient';
export { operationInfoApi } from '@/api/operationInfo';
export { anesthesiaDictApi } from '@/api/anesthesiaDict';

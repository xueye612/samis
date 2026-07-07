import { ANESTHESIA_USE_MOCK, samisRequest } from '@/api/samisClient';

export interface PushBatchItem {
  entityType: string;
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
    return samisRequest<unknown>(`/anesthesiaDevice/getLatestDeviceData?operationId=${encodeURIComponent(operationId)}`);
  },
};

export { ANESTHESIA_USE_MOCK, samisRequest } from '@/api/samisClient';
export { operationInfoApi } from '@/api/operationInfo';
export { anesthesiaDictApi } from '@/api/anesthesiaDict';

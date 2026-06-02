import type { SyncConflictType } from '@/types/anesthesiaLocalDb';
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
  conflictType?: SyncConflictType;
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

export const anesthesiaSyncApi = {
  pushBatch(body: PushBatchRequest) {
    return samisRequest<PushBatchResponse>('/anesthesiaSync/pushBatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  getSyncStatus(operationId: string) {
    return samisRequest<SyncStatusResponse>(`/anesthesiaSync/getSyncStatus?operationId=${encodeURIComponent(operationId)}`);
  },
  getPendingCount(operationId?: string) {
    const query = operationId ? `?operationId=${encodeURIComponent(operationId)}` : '';
    return samisRequest<{ pendingCount: number }>(`/anesthesiaSync/getPendingCount${query}`);
  },
  confirmBatch(batchNo: string) {
    return samisRequest<{ batchNo: string; confirmed: boolean }>('/anesthesiaSync/confirmBatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchNo }),
    });
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
  saveRecord(body: unknown) {
    return samisRequest<{ localId: string; serverId?: number }>('/anesthesiaRecord/saveRecord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  saveSnapshot(body: unknown) {
    return samisRequest<{ serverId?: number }>('/anesthesiaRecord/saveSnapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  batchSaveVitalSigns(body: unknown) {
    return samisRequest<{ results: PushBatchResultItem[] }>('/anesthesiaRecord/batchSaveVitalSigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
};

export const anesthesiaDeviceApi = {
  batchPushMonitorData(body: unknown) {
    return samisRequest<{ results: PushBatchResultItem[] }>('/anesthesiaDevice/batchPushMonitorData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  batchPushVentilatorData(body: unknown) {
    return samisRequest<{ results: PushBatchResultItem[] }>('/anesthesiaDevice/batchPushVentilatorData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  getLatestDeviceData(operationId: string) {
    return samisRequest<unknown>(`/anesthesiaDevice/getLatestDeviceData?operationId=${encodeURIComponent(operationId)}`);
  },
};

export const operationInfoApi = {
  getOperationInfo(operationId: string) {
    return samisRequest<unknown>(`/operationInfo/getOperationInfo?operationId=${encodeURIComponent(operationId)}`);
  },
};

export { ANESTHESIA_USE_MOCK, samisRequest } from '@/api/samisClient';
export { anesthesiaDictApi } from '@/api/anesthesiaDict';

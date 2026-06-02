import { getMutableDataset } from '@/services/datasetStore';
import { buildSamisSuccess } from '@/api/samisResponse';
import type { SamisApiResponse } from '@/api/samisResponse';
import type { PushBatchRequest, PushBatchResponse, PushBatchResultItem } from '@/api/anesthesiaSync';
import type { QualityDataset } from '@/types/mockTables';
import type { SurgeryCase } from '@/types/anesthesia';
import type {
  AnesthesiaRecordDocument,
  AnesthesiaRecordSnapshot,
  LabResultRecord,
  RecordSummaryFields,
  TransfusionEventRecord,
} from '@/types/anesthesiaRecord';
import { seedDrugDict } from '@/mock/configSeed';
import { drugDictItemToApi } from '@/services/drugDictMapper';
import { buildDrugRecommendFromDict } from '@/services/drugDictRecommend';
import { SPECIAL_DRUG_CATEGORY_OPTIONS } from '@/types/drugDict';

export interface AnesthesiaRecordApiPayload {
  case: SurgeryCase;
  snapshot?: AnesthesiaRecordSnapshot;
  document?: AnesthesiaRecordDocument;
  labResults?: LabResultRecord[];
  transfusionEvents?: TransfusionEventRecord[];
  summary?: RecordSummaryFields;
}

const recordStore = new Map<string, AnesthesiaRecordApiPayload>();
const serverIdCounter = { value: 10000 };

interface MockServerEntity {
  entityType: string;
  localId: string;
  serverId: number;
  syncVersion: number;
  payload: unknown;
  deletedAt?: string;
  isCorrected?: boolean;
  collectTime?: string;
  recordLocked?: boolean;
  recordPrinted?: boolean;
}

const serverEntityRegistry = new Map<string, MockServerEntity>();

function entityKey(entityType: string, localId: string) {
  return `${entityType}:${localId}`;
}

function nextServerId() {
  serverIdCounter.value += 1;
  return serverIdCounter.value;
}

function parseBody<T>(init?: RequestInit): T {
  return JSON.parse(String(init?.body ?? '{}')) as T;
}

function getPayloadField(payload: unknown, key: string) {
  if (!payload || typeof payload !== 'object') return undefined;
  return (payload as Record<string, unknown>)[key];
}

function handleSamisSyncPushBatch(body: PushBatchRequest): SamisApiResponse<PushBatchResponse> {
  const results: PushBatchResultItem[] = body.items.map((item) => {
    const localId = item.localId;
    const entityType = item.entityType;
    const key = entityKey(entityType, localId);
    const baseSyncVersion = item.baseSyncVersion ?? Number(getPayloadField(item.payload, 'baseSyncVersion') ?? 0);
    const operationType = item.operationType;
    const payload = item.payload ?? {};
    const recordLocked = Boolean(getPayloadField(payload, 'recordLocked') ?? getPayloadField(body, 'recordLocked'));
    const recordPrinted = Boolean(getPayloadField(payload, 'recordPrinted'));

    if (recordLocked || recordPrinted) {
      if (operationType === 'update' || operationType === 'delete' || operationType === 'void') {
        const existing = serverEntityRegistry.get(key);
        return {
          entityType,
          localId,
          serverId: existing?.serverId ?? item.serverId ?? null,
          status: 'conflict',
          conflictType: recordPrinted ? 'record_printed' : 'record_locked',
          message: recordPrinted ? 'record printed on server' : 'record locked on server',
          serverSyncVersion: existing?.syncVersion,
          serverPayload: existing?.payload ?? {},
        };
      }
    }

    if (entityType === 'monitor_raw' || entityType === 'ventilator_raw') {
      const collectTime = String(getPayloadField(payload, 'collectTime') ?? getPayloadField(payload, 'collect_time') ?? '');
      const dup = [...serverEntityRegistry.values()].find((row) =>
        row.entityType === entityType
        && (row.localId === localId || (collectTime && row.collectTime === collectTime)),
      );
      if (dup) {
        return {
          entityType,
          localId,
          serverId: dup.serverId,
          status: 'success',
          message: 'deduplicated',
          serverSyncVersion: dup.syncVersion,
        };
      }
      const serverId = nextServerId();
      serverEntityRegistry.set(key, {
        entityType,
        localId,
        serverId,
        syncVersion: 1,
        payload,
        collectTime,
      });
      return { entityType, localId, serverId, status: 'success', serverSyncVersion: 1 };
    }

    if (entityType === 'vital_sign') {
      const existing = serverEntityRegistry.get(key);
      const incomingSource = String(getPayloadField(payload, 'source') ?? '');
      if (existing?.isCorrected && incomingSource.includes('设备')) {
        return {
          entityType,
          localId,
          serverId: existing.serverId,
          status: 'conflict',
          conflictType: 'vital_corrected',
          message: 'vital corrected on server',
          serverSyncVersion: existing.syncVersion,
          serverPayload: existing.payload,
        };
      }
    }

    const conflictTypes = new Set(['medication', 'fluid', 'transfusion', 'timeline_event']);
    const existing = serverEntityRegistry.get(key);
    if (conflictTypes.has(entityType) && existing && baseSyncVersion < existing.syncVersion) {
      return {
        entityType,
        localId,
        serverId: existing.serverId,
        status: 'conflict',
        conflictType: 'version_mismatch',
        message: 'server sync version newer',
        serverSyncVersion: existing.syncVersion,
        serverPayload: existing.payload,
      };
    }

    if (operationType === 'delete' || operationType === 'void') {
      if (existing) {
        existing.deletedAt = new Date().toISOString();
        existing.syncVersion += 1;
        existing.payload = { ...existing.payload as object, deletedAt: existing.deletedAt, voidReason: getPayloadField(payload, 'voidReason') ?? 'void' };
        return {
          entityType,
          localId,
          serverId: existing.serverId,
          status: 'success',
          serverSyncVersion: existing.syncVersion,
        };
      }
      return { entityType, localId, serverId: nextServerId(), status: 'success', serverSyncVersion: 1 };
    }

    const nextVersion = existing ? existing.syncVersion + 1 : 1;
    const isCorrected = getPayloadField(payload, 'source') === '手工修正' || Boolean(getPayloadField(payload, 'correctedValue'));
    const serverId = existing?.serverId ?? item.serverId ?? nextServerId();
    serverEntityRegistry.set(key, {
      entityType,
      localId,
      serverId,
      syncVersion: nextVersion,
      payload,
      isCorrected: isCorrected || existing?.isCorrected,
    });
    return {
      entityType,
      localId,
      serverId,
      status: 'success',
      serverSyncVersion: nextVersion,
    };
  });
  return buildSamisSuccess({ batchNo: body.batchNo, results });
}

function handleSamisDeviceBatch(body: { items?: Array<{ localId: string }> }, entityType: string) {
  const items = body.items ?? [];
  return buildSamisSuccess({
    results: items.map((item) => ({
      entityType,
      localId: item.localId,
      serverId: nextServerId(),
      status: 'success' as const,
      message: '',
    })),
  });
}

export function getQualityDataset(): QualityDataset {
  return getMutableDataset();
}

export const mockApi = {
  getQualityDataset,
  getAnesthesiaRecord(caseId: string) {
    return recordStore.get(caseId) ?? null;
  },
  saveAnesthesiaRecord(payload: AnesthesiaRecordApiPayload) {
    recordStore.set(payload.case.id, payload);
    return payload;
  },
  listAnesthesiaRecords() {
    return Array.from(recordStore.values());
  },
};

export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  if (path.startsWith('/quality/dataset')) return getQualityDataset() as T;

  // Legacy mock routes (historical reference only)
  if (path.startsWith('/anesthesia/records/') && (!init?.method || init.method === 'GET')) {
    const caseId = path.split('/').pop() ?? '';
    return mockApi.getAnesthesiaRecord(caseId) as T;
  }
  if (path === '/anesthesia/records' && init?.method === 'POST') {
    const body = parseBody<AnesthesiaRecordApiPayload>(init);
    return mockApi.saveAnesthesiaRecord(body) as T;
  }

  // Samis-style anesthesia APIs (current primary mock surface)
  if (path.endsWith('/anesthesiaSync/pushBatch') && init?.method === 'POST') {
    return handleSamisSyncPushBatch(parseBody<PushBatchRequest>(init)) as T;
  }
  if (path.includes('/anesthesiaSync/getSyncStatus')) {
    return buildSamisSuccess({ pendingCount: 0, online: true, lastSyncedAt: new Date().toISOString() }) as T;
  }
  if (path.includes('/anesthesiaSync/getPendingCount')) {
    return buildSamisSuccess({ pendingCount: 0 }) as T;
  }
  if (path.endsWith('/anesthesiaSync/confirmBatch') && init?.method === 'POST') {
    const body = parseBody<{ batchNo: string }>(init);
    return buildSamisSuccess({ batchNo: body.batchNo, confirmed: true }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/saveRecord') && init?.method === 'POST') {
    const body = parseBody<{ localId?: string; caseId?: string }>(init);
    return buildSamisSuccess({ localId: body.localId ?? body.caseId ?? 'local-record', serverId: nextServerId() }) as T;
  }
  if (path.endsWith('/anesthesiaRecord/batchSaveVitalSigns') && init?.method === 'POST') {
    const body = parseBody<{ items?: Array<{ localId?: string; id?: string }> }>(init);
    const items = body.items ?? [];
    return buildSamisSuccess({
      results: items.map((item) => ({
        entityType: 'vital_sign',
        localId: item.localId ?? item.id ?? `vital-${Date.now()}`,
        serverId: nextServerId(),
        status: 'success' as const,
        message: '',
      })),
    }) as T;
  }
  if (path.endsWith('/anesthesiaDevice/batchPushMonitorData') && init?.method === 'POST') {
    return handleSamisDeviceBatch(parseBody(init), 'monitor_raw') as T;
  }
  if (path.endsWith('/anesthesiaDevice/batchPushVentilatorData') && init?.method === 'POST') {
    return handleSamisDeviceBatch(parseBody(init), 'ventilator_raw') as T;
  }
  if (path.includes('/anesthesiaDevice/getLatestDeviceData')) {
    return buildSamisSuccess({ monitor: null, ventilator: null }) as T;
  }
  if (path.includes('/anesthesiaRecord/getRecordDetail')) {
    const operationId = new URL(path, 'http://local').searchParams.get('operationId') ?? '';
    const payload = mockApi.getAnesthesiaRecord(operationId);
    return buildSamisSuccess(payload ?? { operationId, record: null }) as T;
  }
  if (path.includes('/operationInfo/getOperationInfo')) {
    const operationId = new URL(path, 'http://local').searchParams.get('operationId') ?? '';
    return buildSamisSuccess({
      operationId,
      patientName: 'Mock Patient',
      surgeryName: 'Mock Surgery',
      room: 'OR-1',
      diagnosis: 'Mock Diagnosis',
    }) as T;
  }
  if (path.includes('/anesthesiaDict/getSpecialDrugCategories')) {
    return buildSamisSuccess(SPECIAL_DRUG_CATEGORY_OPTIONS) as T;
  }
  if (path.includes('/anesthesiaDict/getDrugRecommend')) {
    const params = new URL(path, 'http://local').searchParams;
    const drug = seedDrugDict.find((d) => d.id === params.get('drug_id') || d.name === params.get('drug_name'));
    return buildSamisSuccess(drug ? buildDrugRecommendFromDict(drug) : null) as T;
  }
  if (path.includes('/anesthesiaDict/getDrugDict')) {
    return buildSamisSuccess(seedDrugDict.filter((d) => d.enabled).map(drugDictItemToApi)) as T;
  }
  if (path.includes('/anesthesiaDict/get')) {
    return buildSamisSuccess([]) as T;
  }

  throw new Error(`Mock backend route not implemented: ${path}`);
}

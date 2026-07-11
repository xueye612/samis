import dayjs from 'dayjs';
import type {
  LocalSyncQueueRow,
  SyncEntityType,
  SyncOperationType,
} from '@/types/anesthesiaLocalDb';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';

const nowIso = () => dayjs().toISOString();
export const ANESTHESIA_SYNC_QUEUE_API_PATH = '/api-samis/pc/v1/anesthesiaSync/pushBatch';

export interface EnqueueSyncInput {
  recordLocalId: string;
  recordServerId?: number | null;
  operationId: string;
  entityType: SyncEntityType;
  entityLocalId: string;
  entityServerId?: number | null;
  operationType: SyncOperationType;
  baseSyncVersion: number;
  apiPath: string;
  payload: unknown;
  batchNo?: string;
}

export function buildBatchNo(prefix = 'front'): string {
  return `${prefix}_${dayjs().format('YYYYMMDD_HHmmss')}_${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
}

export async function readEntityBaseSyncVersion(
  recordLocalId: string,
  entityType: SyncEntityType,
  entityLocalId: string,
): Promise<number> {
  const db = getAnesthesiaLocalDb();
  if (entityType === 'record') {
    return (await db.records.get(entityLocalId))?.sync_version ?? 1;
  }
  const tableMap: Partial<Record<SyncEntityType, keyof typeof db>> = {
    vital_sign: 'vital_signs',
    monitor_raw: 'monitor_raw',
    ventilator_raw: 'ventilator_raw',
    medication: 'medications',
    timeline_event: 'timeline_events',
    fluid: 'fluids',
    transfusion: 'transfusions',
    io_record: 'io_records',
    lab_result: 'lab_results',
    airway_record: 'airway_records',
    ventilation_segment: 'ventilation_segments',
    infusion_segment: 'infusion_segments',
    transfusion_verification: 'transfusion_verifications',
    rescue_event: 'rescue_events',
    rescue_action: 'rescue_actions',
  };
  const tableName = tableMap[entityType];
  if (!tableName) return 1;
  const table = db[tableName] as { get: (id: string) => Promise<{ sync_version?: number } | undefined> };
  return (await table.get(entityLocalId))?.sync_version ?? 1;
}

export async function enqueueSyncItem(input: EnqueueSyncInput): Promise<LocalSyncQueueRow> {
  const db = getAnesthesiaLocalDb();
  const ts = nowIso();
  const baseSyncVersion = input.baseSyncVersion ?? await readEntityBaseSyncVersion(
    input.recordLocalId,
    input.entityType,
    input.entityLocalId,
  );
  const row: LocalSyncQueueRow = {
    queue_id: `${input.entityType}-${input.entityLocalId}-${Date.now()}`,
    batch_no: input.batchNo,
    record_local_id: input.recordLocalId,
    record_server_id: input.recordServerId ?? null,
    operation_id: input.operationId,
    entity_type: input.entityType,
    local_id: input.entityLocalId,
    entity_local_id: input.entityLocalId,
    server_id: input.entityServerId ?? null,
    entity_server_id: input.entityServerId ?? null,
    operation_type: input.operationType,
    base_sync_version: baseSyncVersion,
    api_path: input.apiPath,
    payload: JSON.stringify({
      ...(typeof input.payload === 'object' && input.payload ? input.payload as object : {}),
      localId: input.entityLocalId,
      serverId: input.entityServerId ?? null,
      baseSyncVersion,
      syncVersion: baseSyncVersion,
    }),
    status: 'pending',
    retry_count: 0,
    created_at: ts,
    updated_at: ts,
  };
  await db.sync_queue.put(row);
  return row;
}

export async function getPendingSyncCount(recordLocalId?: string): Promise<number> {
  const db = getAnesthesiaLocalDb();
  let rows = await db.sync_queue.where('status').anyOf(['pending', 'uploading']).toArray();
  if (recordLocalId) rows = rows.filter((row) => row.record_local_id === recordLocalId);
  return rows.length;
}

export async function getFailedSyncCount(recordLocalId?: string): Promise<number> {
  const db = getAnesthesiaLocalDb();
  let rows = await db.sync_queue.where('status').equals('failed').toArray();
  if (recordLocalId) rows = rows.filter((row) => row.record_local_id === recordLocalId);
  return rows.length;
}

export async function listPendingSyncItems(limit = 50, recordLocalId?: string): Promise<LocalSyncQueueRow[]> {
  const db = getAnesthesiaLocalDb();
  const now = nowIso();
  let rows = await db.sync_queue
    .where('status')
    .anyOf(['pending', 'failed'])
    .toArray();
  rows = rows.filter((row) => !row.next_retry_at || row.next_retry_at <= now);
  if (recordLocalId) rows = rows.filter((row) => row.record_local_id === recordLocalId);
  rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return rows.slice(0, limit);
}

export async function markSyncItemFailed(queueId: string, error: string, retryCount: number) {
  const db = getAnesthesiaLocalDb();
  const existing = await db.sync_queue.get(queueId);
  if (!existing || existing.status === 'conflict') return;
  const delaySeconds = Math.min(300, 5 * Math.pow(2, retryCount));
  await db.sync_queue.put({
    ...existing,
    status: 'failed',
    retry_count: retryCount,
    last_error: error,
    next_retry_at: dayjs().add(delaySeconds, 'second').toISOString(),
    updated_at: nowIso(),
  });
}

export async function markSyncItemSuccess(queueId: string, serverId?: number | null) {
  const db = getAnesthesiaLocalDb();
  const existing = await db.sync_queue.get(queueId);
  if (!existing) return;
  await db.sync_queue.put({
    ...existing,
    status: 'success',
    server_id: serverId ?? existing.server_id ?? null,
    entity_server_id: serverId ?? existing.entity_server_id ?? null,
    last_error: undefined,
    updated_at: nowIso(),
  });
}

export async function assignBatchNo(queueIds: string[], batchNo: string) {
  const db = getAnesthesiaLocalDb();
  const ts = nowIso();
  await db.transaction('rw', db.sync_queue, async () => {
    for (const queueId of queueIds) {
      const existing = await db.sync_queue.get(queueId);
      if (!existing || existing.status === 'conflict') continue;
      await db.sync_queue.put({ ...existing, batch_no: batchNo, status: 'uploading', updated_at: ts });
    }
  });
}

export async function requeueSyncItem(queueId: string, baseSyncVersion: number) {
  const db = getAnesthesiaLocalDb();
  const existing = await db.sync_queue.get(queueId);
  if (!existing) return;
  const payload = JSON.parse(existing.payload || '{}');
  await db.sync_queue.put({
    ...existing,
    status: 'pending',
    base_sync_version: baseSyncVersion,
    payload: JSON.stringify({ ...payload, baseSyncVersion, syncVersion: baseSyncVersion }),
    conflict_id: undefined,
    last_error: undefined,
    next_retry_at: undefined,
    updated_at: nowIso(),
  });
}

import dayjs from 'dayjs';
import type { Table } from 'dexie';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';
import { ANESTHESIA_SYNC_QUEUE_API_PATH, enqueueSyncItem } from '@/services/anesthesia/anesthesiaSyncQueue';
import type { LocalStructuredRecordRow, SyncEntityType } from '@/types/anesthesiaLocalDb';

export type StructuredRecordEntityType = Extract<
  SyncEntityType,
  | 'airway_record'
  | 'ventilation_segment'
  | 'infusion_segment'
  | 'transfusion_verification'
  | 'rescue_event'
  | 'rescue_action'
>;

const tableNameByEntity: Record<StructuredRecordEntityType, keyof ReturnType<typeof getAnesthesiaLocalDb>> = {
  airway_record: 'airway_records',
  ventilation_segment: 'ventilation_segments',
  infusion_segment: 'infusion_segments',
  transfusion_verification: 'transfusion_verifications',
  rescue_event: 'rescue_events',
  rescue_action: 'rescue_actions',
};

function tableFor(entityType: StructuredRecordEntityType): Table<LocalStructuredRecordRow, string> {
  const db = getAnesthesiaLocalDb();
  return db[tableNameByEntity[entityType]] as Table<LocalStructuredRecordRow, string>;
}

export interface SaveStructuredRecordInput {
  entityType: StructuredRecordEntityType;
  localId: string;
  operationId: string;
  recordLocalId: string;
  recordServerId?: number | null;
  occurredAt?: string;
  payload: Record<string, unknown>;
}

export interface HydrateStructuredRecordInput extends SaveStructuredRecordInput {
  serverId: number;
  syncVersion: number;
}

/**
 * 将 GET 聚合返回的服务端实体写入本地只读镜像，使后续编辑携带真实 serverId/version。
 * 本地仍有未同步改动时不得用服务端快照覆盖。
 */
export async function hydrateStructuredRecordFromServer(input: HydrateStructuredRecordInput): Promise<LocalStructuredRecordRow> {
  const table = tableFor(input.entityType);
  const existing = await table.get(input.localId);
  if (existing && existing.sync_status !== 'success') return existing;
  const now = dayjs().toISOString();
  const row: LocalStructuredRecordRow = {
    local_id: input.localId,
    server_id: input.serverId,
    sync_version: input.syncVersion,
    sync_status: 'success',
    record_local_id: input.recordLocalId,
    record_server_id: input.recordServerId ?? existing?.record_server_id ?? null,
    operation_id: input.operationId,
    occurred_at: input.occurredAt,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    payload: JSON.stringify(input.payload),
  };
  await table.put(row);
  return row;
}

export async function saveStructuredRecord(input: SaveStructuredRecordInput): Promise<LocalStructuredRecordRow> {
  const table = tableFor(input.entityType);
  const existing = await table.get(input.localId);
  const now = dayjs().toISOString();
  const row: LocalStructuredRecordRow = {
    local_id: input.localId,
    server_id: existing?.server_id ?? null,
    sync_version: existing?.sync_version ?? 1,
    sync_status: 'local_only',
    record_local_id: input.recordLocalId,
    record_server_id: input.recordServerId ?? existing?.record_server_id ?? null,
    operation_id: input.operationId,
    occurred_at: input.occurredAt,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    payload: JSON.stringify(input.payload),
  };
  await table.put(row);
  await enqueueSyncItem({
    recordLocalId: input.recordLocalId,
    recordServerId: row.record_server_id,
    operationId: input.operationId,
    entityType: input.entityType,
    entityLocalId: input.localId,
    entityServerId: row.server_id,
    operationType: existing ? 'update' : 'create',
    baseSyncVersion: row.sync_version,
    apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
    payload: input.payload,
  });
  return row;
}

export async function listStructuredRecords(
  entityType: StructuredRecordEntityType,
  operationId: string,
): Promise<LocalStructuredRecordRow[]> {
  const rows = await tableFor(entityType).where('operation_id').equals(operationId).toArray();
  return rows.filter((row) => !row.deleted_at).sort((a, b) => (a.occurred_at ?? '').localeCompare(b.occurred_at ?? ''));
}

export async function deleteStructuredRecord(
  entityType: StructuredRecordEntityType,
  localId: string,
  reason: string,
): Promise<void> {
  const table = tableFor(entityType);
  const existing = await table.get(localId);
  if (!existing) return;
  const now = dayjs().toISOString();
  const row = { ...existing, deleted_at: now, void_reason: reason, sync_status: 'local_only' as const, updated_at: now };
  await table.put(row);
  await enqueueSyncItem({
    recordLocalId: row.record_local_id,
    recordServerId: row.record_server_id,
    operationId: row.operation_id,
    entityType,
    entityLocalId: localId,
    entityServerId: row.server_id,
    operationType: 'delete',
    baseSyncVersion: row.sync_version,
    apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
    payload: { voidReason: reason },
  });
}

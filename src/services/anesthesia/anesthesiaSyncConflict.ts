import dayjs from 'dayjs';
import type { SurgeryCase, VitalSign } from '@/types/anesthesia';
import type {
  LocalSyncConflictRow,
  SyncConflictResolveAction,
  SyncConflictType,
  SyncEntityType,
} from '@/types/anesthesiaLocalDb';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';
import { enqueueSyncItem, markSyncItemSuccess } from '@/services/anesthesia/anesthesiaSyncQueue';
import { saveCaseToLocalDb } from '@/services/anesthesia/anesthesiaRecordRepository';
import type { PushBatchResultItem } from '@/api/anesthesiaSync';

const nowIso = () => dayjs().toISOString();

export interface CreateConflictInput {
  recordLocalId: string;
  operationId: string;
  entityType: SyncEntityType;
  entityLocalId: string;
  entityServerId?: number | null;
  queueId?: string;
  conflictType: SyncConflictType;
  localPayload: unknown;
  serverPayload: unknown;
  localSyncVersion: number;
  serverSyncVersion?: number;
}

/** E2E / 开发联调：注入一条待处理冲突，不影响正式 UI。 */
export async function injectMockSyncConflict(recordLocalId: string): Promise<LocalSyncConflictRow> {
  return createSyncConflict({
    recordLocalId,
    operationId: recordLocalId,
    entityType: 'vital_sign',
    entityLocalId: `vital-mock-${Date.now()}`,
    conflictType: 'version_mismatch',
    localPayload: { HR: 88, SBP: 118, DBP: 72, SpO2: 97, source: '手工录入' },
    serverPayload: { HR: 92, SBP: 128, DBP: 78, SpO2: 95, source: '设备采集' },
    localSyncVersion: 2,
    serverSyncVersion: 3,
  });
}

export async function createSyncConflict(input: CreateConflictInput): Promise<LocalSyncConflictRow> {
  const db = getAnesthesiaLocalDb();
  const ts = nowIso();
  const row: LocalSyncConflictRow = {
    conflict_id: `conflict-${input.entityType}-${input.entityLocalId}-${Date.now()}`,
    record_local_id: input.recordLocalId,
    operation_id: input.operationId,
    entity_type: input.entityType,
    entity_local_id: input.entityLocalId,
    entity_server_id: input.entityServerId ?? null,
    queue_id: input.queueId,
    conflict_type: input.conflictType,
    local_payload: JSON.stringify(input.localPayload ?? {}),
    server_payload: JSON.stringify(input.serverPayload ?? {}),
    local_sync_version: input.localSyncVersion,
    server_sync_version: input.serverSyncVersion,
    resolve_status: 'pending',
    created_at: ts,
    updated_at: ts,
  };
  await db.sync_conflicts.put(row);
  if (input.queueId) {
    const queueItem = await db.sync_queue.get(input.queueId);
    if (queueItem) {
      await db.sync_queue.put({
        ...queueItem,
        status: 'conflict',
        conflict_id: row.conflict_id,
        last_error: `conflict:${input.conflictType}`,
        updated_at: ts,
      });
    }
  }
  return row;
}

export async function listPendingConflicts(recordLocalId?: string): Promise<LocalSyncConflictRow[]> {
  const db = getAnesthesiaLocalDb();
  let rows = await db.sync_conflicts.where('resolve_status').equals('pending').toArray();
  if (recordLocalId) rows = rows.filter((row) => row.record_local_id === recordLocalId);
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getPendingConflictCount(recordLocalId?: string): Promise<number> {
  const rows = await listPendingConflicts(recordLocalId);
  return rows.length;
}

export async function getConflictById(conflictId: string) {
  return getAnesthesiaLocalDb().sync_conflicts.get(conflictId);
}

/** 人工修正生命体征不可被设备数据覆盖 */
export function canDeviceOverwriteVital(existing: VitalSign | LocalVitalLike | undefined, incomingSource?: string): boolean {
  if (!existing) return true;
  const isIncomingDevice = incomingSource?.includes('设备') ?? false;
  if (!isIncomingDevice) return true;
  if ('is_corrected' in existing && existing.is_corrected) return false;
  if ('source' in existing && (existing.source === '手工修正' || existing.correctedValue)) return false;
  return true;
}

interface LocalVitalLike {
  is_corrected?: boolean;
  source?: string;
  correctedValue?: Record<string, number | string>;
}

/** 设备 raw 按 local_id 或 collect_time 去重 */
export async function findExistingDeviceRaw(
  entityType: 'monitor_raw' | 'ventilator_raw',
  recordLocalId: string,
  localId: string,
  collectTime: string,
) {
  const db = getAnesthesiaLocalDb();
  const table = entityType === 'monitor_raw' ? db.monitor_raw : db.ventilator_raw;
  const byId = await table.get(localId);
  if (byId) return byId;
  const rows = await table.where('record_local_id').equals(recordLocalId).toArray();
  return rows.find((row) => row.collect_time === collectTime);
}

export function parseConflictTypeFromResult(result: PushBatchResultItem): SyncConflictType {
  if (result.conflictType) return result.conflictType;
  if (result.message?.includes('locked')) return 'record_locked';
  if (result.message?.includes('printed')) return 'record_printed';
  if (result.message?.includes('corrected')) return 'vital_corrected';
  return 'version_mismatch';
}

function applyServerPayloadToCase(caseItem: SurgeryCase, entityType: SyncEntityType, entityLocalId: string, serverPayload: unknown) {
  const payload = serverPayload as Record<string, unknown>;
  if (entityType === 'vital_sign') {
    const idx = caseItem.vitals.findIndex((v) => v.id === entityLocalId);
    if (idx >= 0) caseItem.vitals[idx] = { ...caseItem.vitals[idx], ...(payload as Partial<VitalSign>) };
  } else if (entityType === 'medication') {
    const idx = caseItem.medications.findIndex((v) => v.id === entityLocalId);
    if (idx >= 0) caseItem.medications[idx] = { ...caseItem.medications[idx], ...(payload as Partial<typeof caseItem.medications[number]>) };
  } else if (entityType === 'fluid' || entityType === 'transfusion') {
    const idx = caseItem.fluids.findIndex((v) => v.id === entityLocalId);
    if (idx >= 0) caseItem.fluids[idx] = { ...caseItem.fluids[idx], ...(payload as Partial<typeof caseItem.fluids[number]>) };
  } else if (entityType === 'timeline_event') {
    const idx = caseItem.events.findIndex((v) => v.id === entityLocalId);
    if (idx >= 0) caseItem.events[idx] = { ...caseItem.events[idx], ...(payload as Partial<typeof caseItem.events[number]>) };
  }
}

export async function resolveSyncConflict(
  conflictId: string,
  action: SyncConflictResolveAction,
  caseItem: SurgeryCase,
  options?: { mergedPayload?: unknown; note?: string },
): Promise<void> {
  const db = getAnesthesiaLocalDb();
  const conflict = await db.sync_conflicts.get(conflictId);
  if (!conflict || conflict.resolve_status !== 'pending') return;
  const ts = nowIso();
  const serverPayload = JSON.parse(conflict.server_payload || '{}');
  const localPayload = JSON.parse(conflict.local_payload || '{}');

  if (action === 'use_server') {
    applyServerPayloadToCase(caseItem, conflict.entity_type, conflict.entity_local_id, serverPayload);
    await saveCaseToLocalDb(caseItem, undefined, { skipQueue: true });
  } else if (action === 'keep_local_correction') {
    const corrected = {
      ...localPayload,
      source: '手工修正',
      correctedValue: localPayload.displayValue ?? localPayload,
    };
    applyServerPayloadToCase(caseItem, conflict.entity_type, conflict.entity_local_id, corrected);
    await saveCaseToLocalDb(caseItem, undefined, {
      entityType: conflict.entity_type,
      entityLocalId: conflict.entity_local_id,
      operationType: 'update',
      baseSyncVersion: (conflict.server_sync_version ?? conflict.local_sync_version) + 1,
      payload: corrected,
    });
  } else if (action === 'manual_merge' && options?.mergedPayload) {
    applyServerPayloadToCase(caseItem, conflict.entity_type, conflict.entity_local_id, options.mergedPayload);
    await saveCaseToLocalDb(caseItem, undefined, {
      entityType: conflict.entity_type,
      entityLocalId: conflict.entity_local_id,
      operationType: 'update',
      baseSyncVersion: conflict.server_sync_version ?? conflict.local_sync_version,
      payload: options.mergedPayload,
    });
  } else if (action === 'ignore_local') {
    applyServerPayloadToCase(caseItem, conflict.entity_type, conflict.entity_local_id, serverPayload);
    await saveCaseToLocalDb(caseItem, undefined, { skipQueue: true });
  } else if (action === 'retry_sync') {
    await enqueueSyncItem({
      recordLocalId: conflict.record_local_id,
      operationId: conflict.operation_id,
      entityType: conflict.entity_type,
      entityLocalId: conflict.entity_local_id,
      entityServerId: conflict.entity_server_id,
      operationType: 'update',
      baseSyncVersion: conflict.server_sync_version ?? conflict.local_sync_version,
      apiPath: '/api-samis/pc/v1/anesthesiaSync/pushBatch',
      payload: localPayload,
    });
  }

  if (conflict.queue_id && (action === 'use_server' || action === 'ignore_local')) {
    await markSyncItemSuccess(conflict.queue_id, conflict.entity_server_id ?? null);
  }

  await db.sync_conflicts.put({
    ...conflict,
    resolve_status: action === 'ignore_local' ? 'ignored' : 'resolved',
    resolve_action: action,
    resolve_note: options?.note,
    resolved_at: ts,
    updated_at: ts,
  });
}

export function conflictTypeLabel(type: SyncConflictType): string {
  const map: Record<SyncConflictType, string> = {
    version_mismatch: '版本冲突',
    record_locked: '记录已锁定',
    record_printed: '记录已打印',
    vital_corrected: '生命体征已人工修正',
    entity_conflict: '实体冲突',
    server_newer: '服务器版本更新',
  };
  return map[type] ?? type;
}

export function resolveActionLabel(action: SyncConflictResolveAction): string {
  const map: Record<SyncConflictResolveAction, string> = {
    use_server: '使用服务器版本',
    keep_local_correction: '保留本地修正',
    manual_merge: '人工合并',
    ignore_local: '忽略本地变更',
    retry_sync: '重试同步',
  };
  return map[action] ?? action;
}

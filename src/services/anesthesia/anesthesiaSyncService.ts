import dayjs from 'dayjs';
import type { AnesthesiaSyncState } from '@/types/anesthesiaLocalDb';
import {
  assignBatchNo,
  buildBatchNo,
  getFailedSyncCount,
  getPendingSyncCount,
  listPendingSyncItems,
  markSyncItemFailed,
  markSyncItemSuccess,
} from '@/services/anesthesia/anesthesiaSyncQueue';
import {
  createSyncConflict,
  getPendingConflictCount,
  parseConflictTypeFromResult,
} from '@/services/anesthesia/anesthesiaSyncConflict';
import { anesthesiaSyncApi } from '@/api/anesthesiaSync';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';
import { mapSyncQueueRowsToPushBatchItems } from '@/services/anesthesia/syncPayloadMapper';

type SyncListener = (state: AnesthesiaSyncState) => void;

const MANUAL_DELAY_MS = 1500;
const VITAL_BATCH_DELAY_MS = 8000;
const DEVICE_BATCH_DELAY_MS = 15000;
const SCAN_INTERVAL_MS = 5000;

let started = false;
let uploading = false;
let lastSyncSuccessAt: string | undefined;
let lastSyncError: string | undefined;
let listeners: SyncListener[] = [];
let manualTimer: ReturnType<typeof setTimeout> | undefined;
let vitalTimer: ReturnType<typeof setTimeout> | undefined;
let deviceTimer: ReturnType<typeof setTimeout> | undefined;
let scanTimer: ReturnType<typeof setInterval> | undefined;
let lastPublishedState: AnesthesiaSyncState | undefined;
let activeRecordLocalId: string | undefined;

const deviceUiState: Pick<AnesthesiaSyncState, 'monitorRunning' | 'ventilatorRunning' | 'lastCollectTime' | 'rescueMode' | 'localSavedAt'> = {
  monitorRunning: false,
  ventilatorRunning: false,
  lastCollectTime: undefined,
  rescueMode: false,
  localSavedAt: undefined,
};

const deviceEntityTypes = new Set(['monitor_raw', 'ventilator_raw']);
const vitalEntityTypes = new Set(['vital_sign']);

function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function mergeDeviceUiPatch(extra: Partial<AnesthesiaSyncState>) {
  if (extra.monitorRunning !== undefined) deviceUiState.monitorRunning = extra.monitorRunning;
  if (extra.ventilatorRunning !== undefined) deviceUiState.ventilatorRunning = extra.ventilatorRunning;
  if (extra.lastCollectTime !== undefined) deviceUiState.lastCollectTime = extra.lastCollectTime;
  if (extra.rescueMode !== undefined) deviceUiState.rescueMode = extra.rescueMode;
  if (extra.localSavedAt !== undefined) deviceUiState.localSavedAt = extra.localSavedAt;
}

export function syncStatesEqual(a: AnesthesiaSyncState, b: AnesthesiaSyncState): boolean {
  return a.pendingCount === b.pendingCount
    && a.conflictCount === b.conflictCount
    && a.uploading === b.uploading
    && a.lastSyncSuccessAt === b.lastSyncSuccessAt
    && a.lastSyncError === b.lastSyncError
    && a.online === b.online
    && a.monitorRunning === b.monitorRunning
    && a.ventilatorRunning === b.ventilatorRunning
    && a.lastCollectTime === b.lastCollectTime
    && a.rescueMode === b.rescueMode
    && a.localSavedAt === b.localSavedAt
    && a.failedCount === b.failedCount;
}

function notify(extra: Partial<AnesthesiaSyncState> = {}) {
  mergeDeviceUiPatch(extra);
  void Promise.all([
    getPendingSyncCount(activeRecordLocalId),
    getFailedSyncCount(activeRecordLocalId),
    getPendingConflictCount(activeRecordLocalId),
  ]).then(([pendingCount, failedCount, conflictCount]) => {
    const state: AnesthesiaSyncState = {
      pendingCount,
      failedCount,
      conflictCount,
      uploading,
      lastSyncSuccessAt,
      lastSyncError,
      online: isOnline(),
      ...deviceUiState,
    };
    if (lastPublishedState && syncStatesEqual(lastPublishedState, state)) return;
    lastPublishedState = state;
    listeners.forEach((listener) => listener(state));
  });
}

export function subscribeAnesthesiaSyncState(listener: SyncListener) {
  listeners.push(listener);
  notify();
  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}

async function applyServerIds(results: Array<{ entityType: string; localId: string; serverId?: number | null; serverSyncVersion?: number }>) {
  const db = getAnesthesiaLocalDb();
  for (const result of results) {
    if (!result.serverId) continue;
    const tableMap: Record<string, keyof typeof db> = {
      record: 'records',
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
    const tableName = tableMap[result.entityType];
    if (!tableName) continue;
    const table = db[tableName] as {
      get: (id: string) => Promise<{ local_id: string; server_id?: number | null; sync_version?: number } | undefined>;
      put: (row: unknown) => Promise<unknown>;
    };
    const existing = await table.get(result.localId);
    if (existing) {
      await table.put({
        ...existing,
        server_id: result.serverId,
        sync_status: 'success',
        sync_version: result.serverSyncVersion ?? (existing.sync_version ?? 1),
        updated_at: dayjs().toISOString(),
      });
    }
    if (result.entityType === 'record') {
      const record = await db.records.get(result.localId);
      if (record) {
        await db.records.put({
          ...record,
          server_id: result.serverId,
          sync_status: 'success',
          sync_version: result.serverSyncVersion ?? record.sync_version,
          last_synced_at: dayjs().toISOString(),
          updated_at: dayjs().toISOString(),
        });
      }
    }
  }
}

async function pushBatchForItems(items: Awaited<ReturnType<typeof listPendingSyncItems>>) {
  if (!items.length || !isOnline()) return;
  uploading = true;
  notify();
  const batchNo = buildBatchNo();
  const queueIds = items.map((item) => item.queue_id);
  await assignBatchNo(queueIds, batchNo);
  const payloadItems = await mapSyncQueueRowsToPushBatchItems(items);
  const first = items[0];
  try {
    const response = await anesthesiaSyncApi.pushBatch({
      batchNo,
      operationId: first.operation_id,
      recordLocalId: first.record_local_id,
      recordServerId: first.record_server_id,
      clientTime: dayjs().format('YYYY-MM-DD HH:mm:ss.SSS'),
      items: payloadItems,
    });
    for (const result of response.results) {
      const queueItem = items.find((item) => item.local_id === result.localId);
      if (!queueItem) continue;
      if (result.status === 'success') {
        await markSyncItemSuccess(queueItem.queue_id, result.serverId ?? null);
      } else if (result.status === 'conflict') {
        await createSyncConflict({
          recordLocalId: queueItem.record_local_id,
          operationId: queueItem.operation_id,
          entityType: queueItem.entity_type,
          entityLocalId: queueItem.local_id,
          entityServerId: result.serverId ?? queueItem.server_id,
          queueId: queueItem.queue_id,
          conflictType: parseConflictTypeFromResult(result),
          localPayload: JSON.parse(queueItem.payload || '{}'),
          serverPayload: result.serverPayload ?? {},
          localSyncVersion: queueItem.base_sync_version,
          serverSyncVersion: result.serverSyncVersion,
        });
        lastSyncError = result.message ?? '同步冲突';
      } else {
        await markSyncItemFailed(queueItem.queue_id, result.message ?? 'sync failed', queueItem.retry_count + 1);
      }
    }
    await applyServerIds(
      response.results
        .filter((item) => item.status === 'success')
        .map((item) => ({
          entityType: item.entityType,
          localId: item.localId,
          serverId: item.serverId,
          serverSyncVersion: item.serverSyncVersion,
        })),
    );
    if (response.results.some((item) => item.status === 'success')) {
      lastSyncSuccessAt = dayjs().toISOString();
    }
    if (!response.results.some((item) => item.status === 'conflict' || item.status === 'failed')) {
      lastSyncError = undefined;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastSyncError = message;
    await Promise.all(items.map((item) => markSyncItemFailed(item.queue_id, message, item.retry_count + 1)));
  } finally {
    uploading = false;
    notify();
  }
}

async function flushByPredicate(predicate: (entityType: string) => boolean, limit = 30) {
  const pending = await listPendingSyncItems(200);
  const items = pending.filter((item) => predicate(item.entity_type)).slice(0, limit);
  if (items.length) await pushBatchForItems(items);
}

function scheduleManualFlush() {
  if (manualTimer) clearTimeout(manualTimer);
  manualTimer = setTimeout(() => {
    void flushByPredicate((type) => !deviceEntityTypes.has(type) && !vitalEntityTypes.has(type), 20);
  }, MANUAL_DELAY_MS);
}

function scheduleVitalFlush() {
  if (vitalTimer) clearTimeout(vitalTimer);
  vitalTimer = setTimeout(() => {
    void flushByPredicate((type) => vitalEntityTypes.has(type), 40);
  }, VITAL_BATCH_DELAY_MS);
}

function scheduleDeviceFlush() {
  if (deviceTimer) clearTimeout(deviceTimer);
  deviceTimer = setTimeout(() => {
    void flushByPredicate((type) => deviceEntityTypes.has(type), 60);
  }, DEVICE_BATCH_DELAY_MS);
}

export function triggerAnesthesiaSyncAfterChange(entityType?: string) {
  notify();
  if (!entityType || deviceEntityTypes.has(entityType)) {
    scheduleDeviceFlush();
  } else if (vitalEntityTypes.has(entityType)) {
    scheduleVitalFlush();
  } else {
    scheduleManualFlush();
  }
}

export async function flushAnesthesiaSyncNow(recordLocalId?: string) {
  const pending = await listPendingSyncItems(100, recordLocalId);
  if (pending.length) await pushBatchForItems(pending);
}

export function startAnesthesiaSyncService() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => {
    notify();
    void flushAnesthesiaSyncNow();
  });
  window.addEventListener('offline', () => notify());
  scanTimer = setInterval(() => {
    if (!isOnline() || uploading) return;
    void listPendingSyncItems(20).then((items) => {
      if (items.length) void pushBatchForItems(items);
    });
  }, SCAN_INTERVAL_MS);
  notify();
}

export function stopAnesthesiaSyncService() {
  if (manualTimer) clearTimeout(manualTimer);
  if (vitalTimer) clearTimeout(vitalTimer);
  if (deviceTimer) clearTimeout(deviceTimer);
  if (scanTimer) clearInterval(scanTimer);
  started = false;
}

export function patchAnesthesiaSyncUiState(patch: Partial<AnesthesiaSyncState>) {
  notify(patch);
}

/** 切换当前打开的记录单时，同步摘要仅统计该 record_local_id 的队列/冲突。 */
export function setAnesthesiaSyncRecordScope(recordLocalId?: string) {
  activeRecordLocalId = recordLocalId;
  notify();
}

export { getPendingConflictCount, listPendingConflicts, resolveSyncConflict } from '@/services/anesthesia/anesthesiaSyncConflict';

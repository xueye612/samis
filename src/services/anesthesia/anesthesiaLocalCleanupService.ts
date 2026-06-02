import dayjs from 'dayjs';
import type { LocalMonitorRawRow, LocalVentilatorRawRow, LocalSyncQueueRow } from '@/types/anesthesiaLocalDb';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';
import { appendAuditLogLocal, SETTINGS_CURRENT_RECORD } from '@/services/anesthesia/anesthesiaRecordRepository';

export const CLEANUP_LAST_RUN_SETTINGS_KEY = 'local_cleanup_last_run_at';
export const CLEANUP_MIN_INTERVAL_HOURS = 6;

export interface LocalCleanupOptions {
  currentRecordRawRetentionHours?: number;
  inactiveSyncedRawRetentionDays?: number;
  syncSuccessRetentionDays?: number;
  currentRecordSuccessKeep?: number;
  currentRecordLocalId?: string;
  dryRun?: boolean;
}

export interface DeviceRawCleanupResult {
  removedMonitorRaw: number;
  removedVentilatorRaw: number;
  keptMonitorRaw: number;
  keptVentilatorRaw: number;
}

export interface SyncQueueCleanupResult {
  removedSuccess: number;
  keptSuccess: number;
}

export interface LocalStorageStats {
  monitorRawCount: number;
  ventilatorRawCount: number;
  syncQueueSuccessCount: number;
  syncQueuePendingCount: number;
  syncQueueFailedCount: number;
  syncQueueConflictCount: number;
  recordCount: number;
}

export interface LocalCleanupSummary extends DeviceRawCleanupResult, SyncQueueCleanupResult {
  dryRun: boolean;
  ranAt: string;
}

const DEFAULT_OPTIONS: Required<Omit<LocalCleanupOptions, 'currentRecordLocalId' | 'dryRun'>> = {
  currentRecordRawRetentionHours: 24,
  inactiveSyncedRawRetentionDays: 7,
  syncSuccessRetentionDays: 3,
  currentRecordSuccessKeep: 200,
};

async function resolveCurrentRecordLocalId(explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit;
  const db = getAnesthesiaLocalDb();
  const row = await db.settings.get(SETTINGS_CURRENT_RECORD);
  return row?.value || undefined;
}

function isProtectedRawRow(
  row: LocalMonitorRawRow | LocalVentilatorRawRow,
  currentRecordLocalId: string | undefined,
  now: dayjs.Dayjs,
  options: Required<Omit<LocalCleanupOptions, 'currentRecordLocalId' | 'dryRun'>>,
): boolean {
  if (row.sync_status !== 'success') return true;
  if (row.deleted_at) return true;
  if (row.record_local_id === currentRecordLocalId) {
    const collectTime = dayjs(row.collect_time);
    if (collectTime.isValid() && now.diff(collectTime, 'hour', true) < options.currentRecordRawRetentionHours) {
      return true;
    }
    return true;
  }
  const ageDays = now.diff(dayjs(row.collect_time), 'day', true);
  return ageDays < options.inactiveSyncedRawRetentionDays;
}

function canDeleteSyncedRawRow(
  row: LocalMonitorRawRow | LocalVentilatorRawRow,
  currentRecordLocalId: string | undefined,
  now: dayjs.Dayjs,
  options: Required<Omit<LocalCleanupOptions, 'currentRecordLocalId' | 'dryRun'>>,
): boolean {
  if (isProtectedRawRow(row, currentRecordLocalId, now, options)) return false;
  if (row.sync_status !== 'success') return false;
  if (row.record_local_id === currentRecordLocalId) return false;
  const ageDays = now.diff(dayjs(row.collect_time), 'day', true);
  return ageDays >= options.inactiveSyncedRawRetentionDays;
}

export async function getLocalStorageStats(): Promise<LocalStorageStats> {
  const db = getAnesthesiaLocalDb();
  const [monitorRawCount, ventilatorRawCount, queueRows, recordCount] = await Promise.all([
    db.monitor_raw.count(),
    db.ventilator_raw.count(),
    db.sync_queue.toArray(),
    db.records.count(),
  ]);
  return {
    monitorRawCount,
    ventilatorRawCount,
    syncQueueSuccessCount: queueRows.filter((row) => row.status === 'success').length,
    syncQueuePendingCount: queueRows.filter((row) => row.status === 'pending' || row.status === 'uploading').length,
    syncQueueFailedCount: queueRows.filter((row) => row.status === 'failed').length,
    syncQueueConflictCount: queueRows.filter((row) => row.status === 'conflict').length,
    recordCount,
  };
}

export async function cleanupSyncedDeviceRaw(options: LocalCleanupOptions = {}): Promise<DeviceRawCleanupResult> {
  const db = getAnesthesiaLocalDb();
  const now = dayjs();
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const currentRecordLocalId = await resolveCurrentRecordLocalId(options.currentRecordLocalId);
  const monitorRows = await db.monitor_raw.toArray();
  const ventilatorRows = await db.ventilator_raw.toArray();

  const monitorDeleteIds = monitorRows
    .filter((row) => canDeleteSyncedRawRow(row, currentRecordLocalId, now, merged))
    .map((row) => row.local_id);
  const ventilatorDeleteIds = ventilatorRows
    .filter((row) => canDeleteSyncedRawRow(row, currentRecordLocalId, now, merged))
    .map((row) => row.local_id);

  if (!options.dryRun) {
    if (monitorDeleteIds.length) await db.monitor_raw.bulkDelete(monitorDeleteIds);
    if (ventilatorDeleteIds.length) await db.ventilator_raw.bulkDelete(ventilatorDeleteIds);
  }

  return {
    removedMonitorRaw: monitorDeleteIds.length,
    removedVentilatorRaw: ventilatorDeleteIds.length,
    keptMonitorRaw: monitorRows.length - monitorDeleteIds.length,
    keptVentilatorRaw: ventilatorRows.length - ventilatorDeleteIds.length,
  };
}

function buildProtectedSuccessQueueIds(
  rows: LocalSyncQueueRow[],
  currentRecordLocalId: string | undefined,
  keepRecent: number,
): Set<string> {
  if (!currentRecordLocalId) return new Set<string>();
  return new Set(
    rows
      .filter((row) => row.record_local_id === currentRecordLocalId && row.status === 'success')
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, keepRecent)
      .map((row) => row.queue_id),
  );
}

export async function cleanupOldSuccessQueue(options: LocalCleanupOptions = {}): Promise<SyncQueueCleanupResult> {
  const db = getAnesthesiaLocalDb();
  const now = dayjs();
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const currentRecordLocalId = await resolveCurrentRecordLocalId(options.currentRecordLocalId);
  const successRows = await db.sync_queue.where('status').equals('success').toArray();
  const protectedIds = buildProtectedSuccessQueueIds(successRows, currentRecordLocalId, merged.currentRecordSuccessKeep);

  const deleteIds = successRows
    .filter((row) => {
      if (protectedIds.has(row.queue_id)) return false;
      const ageDays = now.diff(dayjs(row.updated_at), 'day', true);
      return ageDays >= merged.syncSuccessRetentionDays;
    })
    .map((row) => row.queue_id);

  if (!options.dryRun && deleteIds.length) {
    await db.sync_queue.bulkDelete(deleteIds);
  }

  return {
    removedSuccess: deleteIds.length,
    keptSuccess: successRows.length - deleteIds.length,
  };
}

export async function runConservativeLocalCleanup(options: LocalCleanupOptions = {}): Promise<LocalCleanupSummary> {
  const raw = await cleanupSyncedDeviceRaw(options);
  const queue = await cleanupOldSuccessQueue(options);
  const summary: LocalCleanupSummary = {
    ...raw,
    ...queue,
    dryRun: Boolean(options.dryRun),
    ranAt: dayjs().toISOString(),
  };
  if (!options.dryRun) {
    const db = getAnesthesiaLocalDb();
    await db.settings.put({
      key: CLEANUP_LAST_RUN_SETTINGS_KEY,
      value: summary.ranAt,
      updated_at: summary.ranAt,
    });
    await appendAuditLogLocal(
      (await resolveCurrentRecordLocalId(options.currentRecordLocalId)) ?? 'system',
      'local_cleanup',
      JSON.stringify(summary),
      'system',
    );
  }
  return summary;
}

export async function runStartupLocalCleanupIfDue(options: LocalCleanupOptions = {}): Promise<LocalCleanupSummary | null> {
  const db = getAnesthesiaLocalDb();
  const lastRunRow = await db.settings.get(CLEANUP_LAST_RUN_SETTINGS_KEY);
  if (lastRunRow?.value) {
    const hoursSince = dayjs().diff(dayjs(lastRunRow.value), 'hour', true);
    if (hoursSince < CLEANUP_MIN_INTERVAL_HOURS) return null;
  }
  return runConservativeLocalCleanup(options);
}

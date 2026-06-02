import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import dayjs from 'dayjs';
import { getAnesthesiaLocalDb, resetAnesthesiaLocalDbForTests } from '@/services/anesthesia/localDb';
import {
  cleanupOldSuccessQueue,
  cleanupSyncedDeviceRaw,
  getLocalStorageStats,
} from '@/services/anesthesia/anesthesiaLocalCleanupService';
import { SETTINGS_CURRENT_RECORD } from '@/services/anesthesia/anesthesiaRecordRepository';

describe('anesthesiaLocalCleanupService', () => {
  beforeEach(async () => {
    await resetAnesthesiaLocalDbForTests();
  });

  it('does not delete unsynced raw rows', async () => {
    const db = getAnesthesiaLocalDb();
    await db.settings.put({ key: SETTINGS_CURRENT_RECORD, value: 'case-a', updated_at: dayjs().toISOString() });
    await db.monitor_raw.put({
      local_id: 'raw-local',
      record_local_id: 'case-b',
      operation_id: 'case-b',
      collect_time: dayjs().subtract(10, 'day').toISOString(),
      sync_status: 'local_only',
      sync_version: 1,
      created_at: dayjs().subtract(10, 'day').toISOString(),
      updated_at: dayjs().subtract(10, 'day').toISOString(),
    });
    const result = await cleanupSyncedDeviceRaw({ currentRecordLocalId: 'case-a' });
    expect(result.removedMonitorRaw).toBe(0);
    expect(await db.monitor_raw.count()).toBe(1);
  });

  it('cleans old synced raw for inactive records only', async () => {
    const db = getAnesthesiaLocalDb();
    await db.settings.put({ key: SETTINGS_CURRENT_RECORD, value: 'case-a', updated_at: dayjs().toISOString() });
    await db.monitor_raw.bulkPut([
      {
        local_id: 'raw-old-other',
        record_local_id: 'case-b',
        operation_id: 'case-b',
        collect_time: dayjs().subtract(8, 'day').toISOString(),
        sync_status: 'success',
        sync_version: 1,
        created_at: dayjs().subtract(8, 'day').toISOString(),
        updated_at: dayjs().subtract(8, 'day').toISOString(),
      },
      {
        local_id: 'raw-current',
        record_local_id: 'case-a',
        operation_id: 'case-a',
        collect_time: dayjs().subtract(2, 'hour').toISOString(),
        sync_status: 'success',
        sync_version: 1,
        created_at: dayjs().subtract(2, 'hour').toISOString(),
        updated_at: dayjs().subtract(2, 'hour').toISOString(),
      },
    ]);
    const result = await cleanupSyncedDeviceRaw({ currentRecordLocalId: 'case-a' });
    expect(result.removedMonitorRaw).toBe(1);
    expect(await db.monitor_raw.get('raw-current')).toBeTruthy();
  });

  it('cleans old success queue rows but keeps pending and failed', async () => {
    const db = getAnesthesiaLocalDb();
    await db.settings.put({ key: SETTINGS_CURRENT_RECORD, value: 'case-a', updated_at: dayjs().toISOString() });
    const old = dayjs().subtract(4, 'day').toISOString();
    await db.sync_queue.bulkPut([
      {
        queue_id: 'q-success-old',
        record_local_id: 'case-b',
        operation_id: 'case-b',
        entity_type: 'vital_sign',
        local_id: 'v1',
        entity_local_id: 'v1',
        operation_type: 'create',
        base_sync_version: 1,
        api_path: '/test',
        payload: '{}',
        status: 'success',
        retry_count: 0,
        created_at: old,
        updated_at: old,
      },
      {
        queue_id: 'q-pending',
        record_local_id: 'case-a',
        operation_id: 'case-a',
        entity_type: 'vital_sign',
        local_id: 'v2',
        entity_local_id: 'v2',
        operation_type: 'create',
        base_sync_version: 1,
        api_path: '/test',
        payload: '{}',
        status: 'pending',
        retry_count: 0,
        created_at: old,
        updated_at: old,
      },
      {
        queue_id: 'q-failed',
        record_local_id: 'case-a',
        operation_id: 'case-a',
        entity_type: 'vital_sign',
        local_id: 'v3',
        entity_local_id: 'v3',
        operation_type: 'create',
        base_sync_version: 1,
        api_path: '/test',
        payload: '{}',
        status: 'failed',
        retry_count: 1,
        created_at: old,
        updated_at: old,
      },
    ]);
    const result = await cleanupOldSuccessQueue({ currentRecordLocalId: 'case-a' });
    expect(result.removedSuccess).toBe(1);
    expect(await db.sync_queue.get('q-pending')).toBeTruthy();
    expect(await db.sync_queue.get('q-failed')).toBeTruthy();
    const stats = await getLocalStorageStats();
    expect(stats.syncQueuePendingCount).toBe(1);
    expect(stats.syncQueueFailedCount).toBe(1);
  });
});

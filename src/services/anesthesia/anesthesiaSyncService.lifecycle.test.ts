import { afterEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  checkCanSubmitRecord,
  flushAnesthesiaSyncNow,
  flushQueueForRecord,
  startAnesthesiaSyncService,
  stopAnesthesiaSyncService,
  triggerAnesthesiaSyncAfterChange,
} from '@/services/anesthesia/anesthesiaSyncService';
import { anesthesiaSyncApi } from '@/api/anesthesiaSync';
import { enqueueSyncItem } from '@/services/anesthesia/anesthesiaSyncQueue';
import { getAnesthesiaLocalDb } from '@/services/anesthesia/localDb';

describe('anesthesiaSyncService lifecycle', () => {
  afterEach(() => {
    stopAnesthesiaSyncService();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('设备原始追溯报文可后台续传但不阻塞记录冻结提交', async () => {
    await getAnesthesiaLocalDb().sync_queue.clear();
    await getAnesthesiaLocalDb().sync_conflicts.clear();
    vi.stubGlobal('navigator', { onLine: false });
    await enqueueSyncItem({
      recordLocalId: 'REC-RAW', operationId: 'OP-RAW', entityType: 'monitor_raw',
      entityLocalId: 'RAW-1', operationType: 'create', baseSyncVersion: 1,
      apiPath: '/anesthesiaSync/pushBatch', payload: { collectTime: '2026-07-17 10:00:00' },
    });
    await expect(checkCanSubmitRecord('REC-RAW')).resolves.toEqual({ canSubmit: true, reason: null });
    await getAnesthesiaLocalDb().sync_queue.clear();
  });

  it('提交刷新不会等待仍在持续产生的设备原始报文', async () => {
    await getAnesthesiaLocalDb().sync_queue.clear();
    vi.stubGlobal('navigator', { onLine: true });
    await enqueueSyncItem({
      recordLocalId: 'REC-RAW-FLUSH', operationId: 'OP-RAW-FLUSH', entityType: 'ventilator_raw',
      entityLocalId: 'RAW-FLUSH-1', operationType: 'create', baseSyncVersion: 1,
      apiPath: '/anesthesiaSync/pushBatch', payload: { collectTime: '2026-07-17 10:00:05' },
    });

    await expect(flushQueueForRecord('REC-RAW-FLUSH', 50)).resolves.toBe(true);
    await expect(getAnesthesiaLocalDb().sync_queue.toArray()).resolves.toHaveLength(1);
    await getAnesthesiaLocalDb().sync_queue.clear();
  });

  it('并发立即刷新只领取并推送同一队列项一次', async () => {
    await getAnesthesiaLocalDb().sync_queue.clear();
    vi.stubGlobal('navigator', { onLine: true });
    await enqueueSyncItem({
      recordLocalId: 'REC-SERIAL', operationId: 'OP-SERIAL', entityType: 'record',
      entityLocalId: 'REC-SERIAL', operationType: 'update', baseSyncVersion: 1,
      apiPath: '/anesthesiaSync/pushBatch', payload: { recordStatus: 'recording' },
    });
    let release!: () => void;
    const responseGate = new Promise<void>((resolve) => { release = resolve; });
    const push = vi.spyOn(anesthesiaSyncApi, 'pushBatch').mockImplementation(async (request) => {
      await responseGate;
      return {
        batchNo: request.batchNo,
        results: request.items.map((item) => ({
          entityType: item.entityType,
          localId: item.localId,
          serverId: 901,
          status: 'success' as const,
          serverSyncVersion: 2,
        })),
      };
    });

    const first = flushAnesthesiaSyncNow('REC-SERIAL');
    const second = flushAnesthesiaSyncNow('REC-SERIAL');
    await vi.waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([first, second]);

    expect(push).toHaveBeenCalledTimes(1);
    await getAnesthesiaLocalDb().sync_queue.clear();
  });

  it('同一实体的连续更新只发送最新状态并结清被覆盖队列', async () => {
    await getAnesthesiaLocalDb().sync_queue.clear();
    vi.stubGlobal('navigator', { onLine: true });
    await enqueueSyncItem({
      recordLocalId: 'REC-COALESCE', operationId: 'OP-COALESCE', entityType: 'record',
      entityLocalId: 'REC-COALESCE', operationType: 'update', baseSyncVersion: 1,
      apiPath: '/anesthesiaSync/pushBatch', payload: { recordStatus: 'recording', marker: 'old' },
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await enqueueSyncItem({
      recordLocalId: 'REC-COALESCE', operationId: 'OP-COALESCE', entityType: 'record',
      entityLocalId: 'REC-COALESCE', operationType: 'update', baseSyncVersion: 2,
      apiPath: '/anesthesiaSync/pushBatch', payload: { recordStatus: 'recording', marker: 'latest' },
    });
    const push = vi.spyOn(anesthesiaSyncApi, 'pushBatch').mockImplementation(async (request) => ({
      batchNo: request.batchNo,
      results: request.items.map((item) => ({
        entityType: item.entityType,
        localId: item.localId,
        serverId: 902,
        status: 'success' as const,
        serverSyncVersion: 3,
      })),
    }));

    await flushAnesthesiaSyncNow('REC-COALESCE');

    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0].items).toHaveLength(1);
    expect(push.mock.calls[0][0].items[0].baseSyncVersion).toBe(2);
    expect((await getAnesthesiaLocalDb().sync_queue.toArray()).map((row) => row.status)).toEqual(['success', 'success']);
    await getAnesthesiaLocalDb().sync_queue.clear();
  });

  it('clears timers and removes the same online and offline listeners when stopped', () => {
    vi.useFakeTimers();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('window', { addEventListener, removeEventListener });
    vi.stubGlobal('navigator', { onLine: true });

    startAnesthesiaSyncService();
    triggerAnesthesiaSyncAfterChange('medication');
    triggerAnesthesiaSyncAfterChange('vital_sign');
    triggerAnesthesiaSyncAfterChange('monitor_raw');
    const online = addEventListener.mock.calls.find(([name]) => name === 'online')?.[1];
    const offline = addEventListener.mock.calls.find(([name]) => name === 'offline')?.[1];
    const timersBeforeStop = vi.getTimerCount();
    stopAnesthesiaSyncService();

    expect(timersBeforeStop - vi.getTimerCount()).toBe(4);
    expect(online).toBeTypeOf('function');
    expect(offline).toBeTypeOf('function');
    expect(removeEventListener).toHaveBeenCalledWith('online', online);
    expect(removeEventListener).toHaveBeenCalledWith('offline', offline);
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

type AnesthesiaSyncModule = typeof import('@/api/anesthesiaSync');

let anesthesiaDeviceApi: AnesthesiaSyncModule['anesthesiaDeviceApi'];
let anesthesiaRecordApi: AnesthesiaSyncModule['anesthesiaRecordApi'];
let anesthesiaSyncApi: AnesthesiaSyncModule['anesthesiaSyncApi'];

beforeAll(async () => {
  vi.stubEnv('VITE_ANESTHESIA_USE_MOCK', 'true');
  vi.stubEnv('VITE_USE_REAL_ANESTHESIA_RECORD', 'false');
  vi.stubEnv('VITE_USE_REAL_ANESTHESIA_SYNC', 'false');
  vi.stubEnv('VITE_USE_REAL_DEVICE', 'false');

  const api = await import('@/api/anesthesiaSync');
  anesthesiaDeviceApi = api.anesthesiaDeviceApi;
  anesthesiaRecordApi = api.anesthesiaRecordApi;
  anesthesiaSyncApi = api.anesthesiaSyncApi;
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('anesthesia sync API wrappers', () => {
  it('covers sync core endpoints in mock mode', async () => {
    const pushed = await anesthesiaSyncApi.pushBatch({
      batchNo: 'batch-api-1',
      operationId: 'case-or01',
      recordLocalId: 'case-or01',
      clientTime: new Date().toISOString(),
      items: [
        {
          entityType: 'medication',
          operationType: 'create',
          localId: 'med-push-1',
          baseSyncVersion: 0,
          apiPath: '/api-samis/pc/v1/anesthesiaRecord/batchSaveMedications',
          payload: { drugName: '丙泊酚' },
        },
      ],
    });

    expect(pushed.batchNo).toBe('batch-api-1');
    expect(pushed.results[0]).toEqual(expect.objectContaining({ localId: 'med-push-1', status: 'success' }));
    await expect(anesthesiaSyncApi.getSyncStatus('case-or01'))
      .resolves.toEqual(expect.objectContaining({ online: true, pendingCount: 0 }));
    await expect(anesthesiaSyncApi.getPendingCount('case-or01'))
      .resolves.toEqual({ pendingCount: 0 });
    await expect(anesthesiaSyncApi.confirmBatch('batch-api-1'))
      .resolves.toEqual({ batchNo: 'batch-api-1', confirmed: true });
  });

  it('covers record main endpoints in mock mode', async () => {
    await expect(anesthesiaRecordApi.getRecordDetail({ operationId: 'case-or01' }))
      .resolves.toEqual(expect.objectContaining({ operationId: 'case-or01' }));
    await expect(anesthesiaRecordApi.saveRecord({ localId: 'record-api-1', operationId: 'case-or01' }))
      .resolves.toEqual(expect.objectContaining({ localId: 'record-api-1', serverId: expect.any(Number) }));
    await expect(anesthesiaRecordApi.saveSnapshot({ localId: 'snapshot-api-1', operationId: 'case-or01' }))
      .resolves.toEqual(expect.objectContaining({ serverId: expect.any(Number) }));
  });

  it('posts record child-table batches through samisRequest', async () => {
    const cases = [
      ['timeline_event', () => anesthesiaRecordApi.batchSaveTimelineEvents({
        operationId: 'case-or01',
        items: [{ localId: 'event-api-1', eventName: '入室' }],
      })],
      ['medication', () => anesthesiaRecordApi.batchSaveMedications({
        operationId: 'case-or01',
        items: [{ localId: 'med-api-1', drugName: '丙泊酚' }],
      })],
      ['fluid', () => anesthesiaRecordApi.batchSaveFluids({
        operationId: 'case-or01',
        items: [{ localId: 'fluid-api-1', fluidName: '乳酸钠林格液' }],
      })],
      ['transfusion', () => anesthesiaRecordApi.batchSaveTransfusions({
        operationId: 'case-or01',
        items: [{ localId: 'transfusion-api-1', productName: '红细胞' }],
      })],
      ['vital_sign', () => anesthesiaRecordApi.batchSaveVitalSigns({
        operationId: 'case-or01',
        items: [{ localId: 'vital-api-1', HR: 76 }],
      })],
    ] as const;

    for (const [entityType, run] of cases) {
      const data = await run();
      expect(data.results[0]).toEqual(expect.objectContaining({ entityType, status: 'success' }));
    }
  });

  it('posts record state changes and single child entities', async () => {
    await expect(anesthesiaRecordApi.lockRecord({ operationId: 'case-or01' }))
      .resolves.toEqual(expect.objectContaining({ locked: true }));
    await expect(anesthesiaRecordApi.voidRecord({ operationId: 'case-or01', voidReason: '测试作废' }))
      .resolves.toEqual(expect.objectContaining({ voided: true }));
    await expect(anesthesiaRecordApi.saveIoRecord({ localId: 'io-api-1', operationId: 'case-or01' }))
      .resolves.toEqual(expect.objectContaining({ localId: 'io-api-1', serverId: expect.any(Number) }));
    await expect(anesthesiaRecordApi.saveLabResult({ localId: 'lab-api-1', operationId: 'case-or01' }))
      .resolves.toEqual(expect.objectContaining({ localId: 'lab-api-1', serverId: expect.any(Number) }));
  });

  it('posts sync conflict resolution', async () => {
    await expect(anesthesiaSyncApi.resolveConflict({ conflictId: 'conflict-api-1', action: 'keepLocal' }))
      .resolves.toEqual(expect.objectContaining({
        conflictId: 'conflict-api-1',
        resolved: true,
      }));
  });

  it('keeps device wrappers available in mock mode', async () => {
    await expect(anesthesiaDeviceApi.batchPushMonitorData({
      operationId: 'case-or01',
      items: [{ localId: 'monitor-api-1', collectTime: new Date().toISOString() }],
    })).resolves.toEqual(expect.objectContaining({
      results: [expect.objectContaining({ entityType: 'monitor_raw', localId: 'monitor-api-1' })],
    }));
    await expect(anesthesiaDeviceApi.batchPushVentilatorData({
      operationId: 'case-or01',
      items: [{ localId: 'vent-api-1', collectTime: new Date().toISOString() }],
    })).resolves.toEqual(expect.objectContaining({
      results: [expect.objectContaining({ entityType: 'ventilator_raw', localId: 'vent-api-1' })],
    }));
    const latest = await anesthesiaDeviceApi.getLatestDeviceData('case-or01');
    expect(latest).toEqual(expect.objectContaining({ monitor: null, ventilator: null }));
  });
});

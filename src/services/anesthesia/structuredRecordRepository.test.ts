import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { getAnesthesiaLocalDb, resetAnesthesiaLocalDbForTests } from '@/services/anesthesia/localDb';
import {
  deleteStructuredRecord,
  listStructuredRecords,
  saveStructuredRecord,
  type StructuredRecordEntityType,
} from '@/services/anesthesia/structuredRecordRepository';
import { listPendingSyncItems } from '@/services/anesthesia/anesthesiaSyncQueue';
import { mapSyncQueueRowsToPushBatchItems } from '@/services/anesthesia/syncPayloadMapper';

const operationId = 'OP-STRUCTURED-001';
const recordLocalId = 'record-structured-001';

const samples: Array<{
  entityType: StructuredRecordEntityType;
  localId: string;
  payload: Record<string, unknown>;
  expectedKey: string;
}> = [
  { entityType: 'airway_record', localId: 'airway-1', payload: { airwayType: 'endotracheal', insertedAt: '2026-07-11 09:00:00' }, expectedKey: 'airwayType' },
  { entityType: 'ventilation_segment', localId: 'ventilation-1', payload: { mode: 'VCV', startTime: '2026-07-11 09:05:00' }, expectedKey: 'mode' },
  { entityType: 'infusion_segment', localId: 'infusion-1', payload: { medicationLocalId: 'medication-1', startTime: '2026-07-11 09:10:00' }, expectedKey: 'medicationLocalId' },
  { entityType: 'transfusion_verification', localId: 'verification-1', payload: { bloodBagNo: 'TEST-BAG-001', verificationStatus: 'verified', verifierOneId: 'u1', verifierTwoId: 'u2' }, expectedKey: 'bloodBagNo' },
  { entityType: 'rescue_event', localId: 'rescue-1', payload: { eventType: 'cardiac_arrest', occurredAt: '2026-07-11 09:15:00' }, expectedKey: 'eventType' },
  { entityType: 'rescue_action', localId: 'action-1', payload: { rescueEventLocalId: 'rescue-1', actionType: 'cpr' }, expectedKey: 'actionType' },
];

describe('structured anesthesia record repository', () => {
  beforeEach(async () => {
    await resetAnesthesiaLocalDbForTests();
  });

  it('persists all structured entities and maps their queue rows to pushBatch payloads', async () => {
    for (const sample of samples) {
      await saveStructuredRecord({
        ...sample,
        operationId,
        recordLocalId,
        occurredAt: '2026-07-11T01:00:00.000Z',
      });
    }

    const queued = await listPendingSyncItems(50, recordLocalId);
    expect(queued.map((item) => item.entity_type)).toEqual(samples.map((item) => item.entityType));

    const mapped = await mapSyncQueueRowsToPushBatchItems(queued);
    for (const sample of samples) {
      const item = mapped.find((candidate) => candidate.entityType === sample.entityType);
      expect(item?.operationType).toBe('create');
      expect(item?.payload).toMatchObject({
        localId: sample.localId,
        [sample.expectedKey]: sample.payload[sample.expectedKey],
      });
    }
  });

  it('hydrates records by operation and queues a delete without losing the local audit row', async () => {
    await saveStructuredRecord({
      ...samples[0],
      operationId,
      recordLocalId,
      occurredAt: '2026-07-11T01:00:00.000Z',
    });

    const activeRows = await listStructuredRecords('airway_record', operationId);
    expect(activeRows).toEqual([
      expect.objectContaining({ local_id: 'airway-1', operation_id: operationId }),
    ]);
    expect(activeRows[0]).not.toHaveProperty('deleted_at');

    await deleteStructuredRecord('airway_record', 'airway-1', '录入错误');

    expect(await listStructuredRecords('airway_record', operationId)).toEqual([]);
    expect(await getAnesthesiaLocalDb().airway_records.get('airway-1')).toEqual(
      expect.objectContaining({ deleted_at: expect.any(String), void_reason: '录入错误' }),
    );
    const queued = await listPendingSyncItems(50, recordLocalId);
    expect(queued[queued.length - 1]).toEqual(expect.objectContaining({ entity_type: 'airway_record', operation_type: 'delete' }));
  });
});

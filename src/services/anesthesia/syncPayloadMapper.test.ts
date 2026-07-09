import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { buildCasePayload } from '@/services/anesthesia/casePayload';
import { getAnesthesiaLocalDb, resetAnesthesiaLocalDbForTests } from '@/services/anesthesia/localDb';
import { mapSyncQueueRowToPushBatchItem } from '@/services/anesthesia/syncPayloadMapper';
import type { LocalSyncQueueRow, SyncEntityType, SyncOperationType } from '@/types/anesthesiaLocalDb';
import type { SurgeryCase } from '@/types/anesthesia';

const now = '2026-07-09T08:00:00.000Z';

const baseCase = (): SurgeryCase => ({
  id: 'case-sync-map',
  room: 'OR-01',
  sequence: 1,
  patientName: '测试患者',
  gender: '男',
  age: 40,
  department: '麻醉科',
  diagnosis: '测试诊断',
  surgeryName: '测试手术',
  surgeon: '李医生',
  anesthesiaMethod: '全身麻醉',
  asa: 'II',
  urgency: '择期',
  anesthesiologist: '王医生',
  anesthesiaNurse: '张护士',
  status: '麻醉中',
  locationType: '手术室内',
  plannedStart: now,
  expectedDurationMinutes: 120,
  locked: false,
  activeWarming: false,
  autologousBlood: false,
  postoperativeAnalgesia: false,
  preVisit: {
    completed: true,
    height: 170,
    weight: 65,
    asa: 'II',
    allergy: '无',
    anesthesiaHistory: '无',
    difficultAirway: '否',
    fasting: '8h',
    preMedication: '无',
    specialCondition: '无',
    plan: '全麻',
    doctorSignature: '王医生',
  },
  vitals: [{ id: 'v1', time: now, HR: 80, SBP: 120, DBP: 70, SpO2: 99, source: '手工录入' }],
  events: [{ id: 'e1', time: now, type: '入室', stage: '入室后', severity: '轻度', staff: ['王医生'], treatment: '患者入室', reported: false, qualityIncluded: false }],
  medications: [{ id: 'm1', drug: '丙泊酚', dose: 100, unit: 'mg', route: '静脉', mode: '单次用药', time: now, executor: '王医生' }],
  fluids: [
    { id: 'f1', category: '晶体液', name: '乳酸林格液', volume: 500, unit: 'ml', startTime: now, executor: '张护士' },
    { id: 't1', category: '血液制品', name: '红细胞', product: '悬浮红细胞', volume: 200, unit: 'ml', startTime: now, executor: '张护士' },
  ],
  outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
  outputRecords: [{ id: 'io1', type: '尿量', volume: 120, time: now }],
  labResults: [{ id: 'lab1', labType: '血气', items: [{ code: 'pH', name: 'pH', value: '7.40', unit: '' }], displayMode: 'brief', resultTime: now, source: 'manual', status: 'active' }],
  recordSnapshot: {
    capturedAt: now,
    hospitalName: '测试医院',
    recordNo: 'AR-001',
    patientName: '测试患者',
    gender: '男',
    age: 40,
    department: '麻醉科',
    asa: 'II',
    diagnosisPreop: '测试诊断',
    surgeryPlanned: '测试手术',
    anesthesiaMethod: '全身麻醉',
    room: 'OR-01',
    surgeonName: '李医生',
    anesthesiologistName: '王医生',
    nurseName: '张护士',
    surgeryDate: '2026-07-09',
  },
});

const queueRow = (
  entityType: SyncEntityType,
  localId: string,
  operationType: SyncOperationType = 'update',
  payload: Record<string, unknown> = {},
): LocalSyncQueueRow => ({
  queue_id: `q-${entityType}-${localId}`,
  record_local_id: 'case-sync-map',
  record_server_id: 7,
  operation_id: 'op-sync-map',
  entity_type: entityType,
  local_id: localId,
  entity_local_id: localId,
  server_id: null,
  entity_server_id: null,
  operation_type: operationType,
  base_sync_version: 12,
  api_path: '/api-samis/pc/v1/anesthesiaRecord/doesNotExist',
  payload: JSON.stringify({ localId, baseSyncVersion: 12, ...payload }),
  status: 'pending',
  retry_count: 0,
  created_at: now,
  updated_at: now,
});

async function seedRows() {
  const db = getAnesthesiaLocalDb();
  const item = baseCase();
  await db.records.put({
    local_id: item.id,
    operation_id: 'op-sync-map',
    patient_id: 'p1',
    record_status: '麻醉中',
    current_page: 2,
    page_count: 3,
    printed_at: undefined,
    locked_at: undefined,
    sync_status: 'local_only',
    sync_version: 12,
    last_saved_at: now,
    created_at: now,
    updated_at: now,
    case_payload: JSON.stringify(item),
  });
  await db.snapshots.put({
    local_id: 'snap1',
    record_local_id: item.id,
    operation_id: 'op-sync-map',
    snapshot_payload: JSON.stringify(item.recordSnapshot),
    sync_status: 'local_only',
    sync_version: 12,
    created_at: now,
    updated_at: now,
  });
  await db.medications.put({
    local_id: 'm1',
    record_local_id: item.id,
    operation_id: 'op-sync-map',
    drug_name: '丙泊酚',
    drug_category: '麻醉药',
    dose: 100,
    dose_unit: 'mg',
    route: '静脉',
    mode: 'single',
    event_time: now,
    start_time: now,
    row_index: 1,
    display_text: '丙泊酚100mg',
    is_special: false,
    sync_status: 'local_only',
    sync_version: 12,
    created_at: now,
    updated_at: now,
    payload: JSON.stringify(item.medications[0]),
  });
  await db.timeline_events.put({
    local_id: 'e1',
    record_local_id: item.id,
    operation_id: 'op-sync-map',
    event_time: now,
    event_type: '入室',
    event_name: '入室',
    description: '患者入室',
    source: 'manual',
    sync_status: 'local_only',
    sync_version: 12,
    created_at: now,
    updated_at: now,
    payload: JSON.stringify(item.events[0]),
  });
  await db.fluids.put({
    local_id: 'f1',
    record_local_id: item.id,
    operation_id: 'op-sync-map',
    fluid_type: '晶体液',
    fluid_name: '乳酸林格液',
    volume: 500,
    volume_unit: 'ml',
    start_time: now,
    sync_status: 'local_only',
    sync_version: 12,
    created_at: now,
    updated_at: now,
    payload: JSON.stringify(item.fluids[0]),
  });
  await db.transfusions.put({
    local_id: 't1',
    record_local_id: item.id,
    operation_id: 'op-sync-map',
    blood_product: '悬浮红细胞',
    volume: 200,
    volume_unit: 'ml',
    start_time: now,
    sync_status: 'local_only',
    sync_version: 12,
    created_at: now,
    updated_at: now,
    payload: JSON.stringify(item.fluids[1]),
  });
  await db.vital_signs.put({
    local_id: 'v1',
    record_local_id: item.id,
    operation_id: 'op-sync-map',
    measure_time: now,
    hr: 80,
    sbp: 120,
    dbp: 70,
    spo2: 99,
    source: '手工录入',
    source_device: 'manual',
    is_display_point: true,
    is_corrected: false,
    sync_status: 'local_only',
    sync_version: 12,
    created_at: now,
    updated_at: now,
    payload: JSON.stringify(item.vitals[0]),
  });
  await db.io_records.put({
    local_id: 'io1',
    record_local_id: item.id,
    operation_id: 'op-sync-map',
    io_type: '尿量',
    volume: 120,
    measure_time: now,
    sync_status: 'local_only',
    sync_version: 12,
    created_at: now,
    updated_at: now,
    payload: JSON.stringify(item.outputRecords![0]),
  });
  await db.lab_results.put({
    local_id: 'lab1',
    record_local_id: item.id,
    operation_id: 'op-sync-map',
    measure_time: now,
    sync_status: 'local_only',
    sync_version: 12,
    created_at: now,
    updated_at: now,
    payload: JSON.stringify(item.labResults![0]),
  });
}

describe('sync payload mapper', () => {
  beforeEach(async () => {
    await resetAnesthesiaLocalDbForTests();
    await seedRows();
  });

  it.each([
    ['record', 'case-sync-map', 'update', 'casePayload', 'currentPage'],
    ['snapshot', 'snap1', 'print', 'snapshotReason', 'snapshot'],
    ['timeline_event', 'e1', 'create', 'eventType', 'eventTime'],
    ['medication', 'm1', 'create', 'drugName', 'doseUnit'],
    ['fluid', 'f1', 'create', 'fluidName', 'volume'],
    ['transfusion', 't1', 'create', 'productName', 'volume'],
    ['vital_sign', 'v1', 'update', 'measureTime', 'HR'],
    ['io_record', 'io1', 'create', 'ioType', 'measureTime'],
    ['lab_result', 'lab1', 'create', 'itemName', 'measureTime'],
  ] as const)('maps %s queue rows to pushBatch item payload', async (entityType, localId, operationType, primaryKey, secondaryKey) => {
    const item = await mapSyncQueueRowToPushBatchItem(queueRow(entityType, localId, operationType));
    expect(item.entityType).toBe(entityType);
    expect(item.operationType).toBe(operationType);
    expect(item.baseSyncVersion).toBe(12);
    expect(item.payload).toMatchObject({ localId, baseSyncVersion: 12 });
    expect(item.payload as Record<string, unknown>).toHaveProperty(primaryKey);
    expect(item.payload as Record<string, unknown>).toHaveProperty(secondaryKey);
  });

  it('keeps apiPath as legacy/debug only and does not let it change pushBatch semantics', async () => {
    const badPath = await mapSyncQueueRowToPushBatchItem(queueRow('medication', 'm1', 'delete'));
    const otherBadPath = await mapSyncQueueRowToPushBatchItem({
      ...queueRow('medication', 'm1', 'delete'),
      api_path: '/api-samis/pc/v1/anesthesiaRecord/saveTimelineEvent',
    });
    expect(badPath.entityType).toBe('medication');
    expect(otherBadPath.entityType).toBe('medication');
    expect(badPath.operationType).toBe('delete');
    expect(otherBadPath.operationType).toBe('delete');
    expect(badPath.payload).toEqual(otherBadPath.payload);
    expect(otherBadPath.apiPath).toContain('saveTimelineEvent');
  });

  it('falls back to the record payload when the entity row payload is missing', async () => {
    const db = getAnesthesiaLocalDb();
    await db.medications.delete('m1');
    const item = await mapSyncQueueRowToPushBatchItem(queueRow('medication', 'm1', 'update'));
    expect(item.entityType).toBe('medication');
    expect(item.payload).toMatchObject({
      localId: 'm1',
      drugName: '丙泊酚',
      doseUnit: 'mg',
    });
  });

  it('passes baseSyncVersion from queue row and preserves stripped record casePayload', async () => {
    const item = await mapSyncQueueRowToPushBatchItem(queueRow('record', 'case-sync-map', 'update'));
    expect(item.baseSyncVersion).toBe(12);
    expect(item.payload).toMatchObject({
      baseSyncVersion: 12,
      syncVersion: 12,
      casePayload: buildCasePayload(baseCase()),
    });
    expect((item.payload as { casePayload?: SurgeryCase }).casePayload?.vitals).toBeUndefined();
  });
});

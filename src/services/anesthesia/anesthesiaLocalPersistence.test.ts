import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { SurgeryCase } from '@/types/anesthesia';
import { resetAnesthesiaLocalDbForTests } from '@/services/anesthesia/localDb';
import { saveCaseToLocalDb, loadCaseFromLocalDb, loadCurrentPageFromLocalDb } from '@/services/anesthesia/anesthesiaRecordRepository';
import { hydrateAnesthesiaCasesFromLocalDb } from '@/services/anesthesia/anesthesiaPersistenceBridge';
import { ANESTHESIA_SYNC_QUEUE_API_PATH, getPendingSyncCount, listPendingSyncItems } from '@/services/anesthesia/anesthesiaSyncQueue';
import { mapSyncQueueRowsToPushBatchItems } from '@/services/anesthesia/syncPayloadMapper';

const baseCase = (): SurgeryCase => ({
  id: 'case-persist-test',
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
  plannedStart: '2026-06-02T08:00:00.000Z',
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
  vitals: [{ id: 'v1', time: '2026-06-02T09:00:00.000Z', HR: 80, SBP: 120, DBP: 70, SpO2: 99, source: '手工录入' }],
  events: [{ id: 'e1', time: '2026-06-02T08:55:00.000Z', type: '入室', stage: '入室后', severity: '轻度', staff: ['王医生'], treatment: '患者入室', reported: false, qualityIncluded: false }],
  medications: [{ id: 'm1', drug: '丙泊酚', dose: 100, unit: 'mg', route: '静脉', mode: '单次用药', time: '2026-06-02T09:05:00.000Z', executor: '王医生' }],
  fluids: [],
  outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
});

describe('anesthesia local persistence', () => {
  beforeEach(async () => {
    await resetAnesthesiaLocalDbForTests();
  });

  it('saves and restores case payload', async () => {
    const item = baseCase();
    await saveCaseToLocalDb(item, 2);
    const restored = await loadCaseFromLocalDb(item.id);
    expect(restored?.patientName).toBe('测试患者');
    expect(restored?.vitals).toHaveLength(1);
    expect(await loadCurrentPageFromLocalDb(item.id)).toBe(2);
  });

  it('enqueues sync item on save', async () => {
    await saveCaseToLocalDb(baseCase(), 1);
    expect(await getPendingSyncCount('case-persist-test')).toBeGreaterThan(0);
  });

  it('enqueues record, timeline_event, medication and vital_sign items for a local save and maps them to pushBatch items', async () => {
    await saveCaseToLocalDb(baseCase(), 1);

    const queueItems = await listPendingSyncItems(50, 'case-persist-test');
    expect(queueItems.map((it) => it.entity_type)).toEqual(expect.arrayContaining([
      'record',
      'timeline_event',
      'medication',
      'vital_sign',
    ]));

    const payloadItems = await mapSyncQueueRowsToPushBatchItems(queueItems);
    expect(payloadItems.map((it) => it.entityType)).toEqual(expect.arrayContaining([
      'record',
      'timeline_event',
      'medication',
      'vital_sign',
    ]));
    expect(payloadItems.find((it) => it.entityType === 'timeline_event')?.payload).toMatchObject({ eventType: '入室' });
    expect(payloadItems.find((it) => it.entityType === 'medication')?.payload).toMatchObject({ drugName: '丙泊酚' });
    expect(payloadItems.find((it) => it.entityType === 'vital_sign')?.payload).toMatchObject({ HR: 80, SBP: 120 });
  });

  it('Slice 3f: record entity enqueue carries casePayload with lists stripped', async () => {
    await saveCaseToLocalDb(baseCase(), 1, {
      entityType: 'record',
      entityLocalId: 'case-persist-test',
      operationType: 'update',
      apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
    });
    const items = await listPendingSyncItems(50, 'case-persist-test');
    const recordItem = items.find((it) => it.entity_type === 'record');
    expect(recordItem).toBeTruthy();
    const payload = JSON.parse(recordItem!.payload || '{}');
    expect(payload.casePayload).toBeTruthy();
    // 列表字段必须被剥离（不进 casePayload，避免双重真值）
    expect(payload.casePayload.vitals).toBeUndefined();
    expect(payload.casePayload.events).toBeUndefined();
    expect(payload.casePayload.medications).toBeUndefined();
    expect(payload.casePayload.fluids).toBeUndefined();
    expect(payload.casePayload.outputRecords).toBeUndefined();
    // case 级字段保留
    expect(payload.casePayload.patientName).toBe('测试患者');
    expect(payload.casePayload.preVisit).toBeTruthy();
    expect(payload.casePayload.outputs).toEqual({ urine: 0, bloodLoss: 0, drainage: 0 });
  });

  it('Slice 3f: non-record entity enqueue omits casePayload', async () => {
    await saveCaseToLocalDb(baseCase(), 1, {
      entityType: 'medication',
      entityLocalId: 'm1',
      operationType: 'create',
      apiPath: ANESTHESIA_SYNC_QUEUE_API_PATH,
    });
    const items = await listPendingSyncItems(50, 'case-persist-test');
    const medItem = items.find((it) => it.entity_type === 'medication');
    expect(medItem).toBeTruthy();
    const payload = JSON.parse(medItem!.payload || '{}');
    expect(payload.casePayload).toBeUndefined();
  });

  it('hydrate keeps remote master data and preserves local clinical records', async () => {
    const local = baseCase();
    local.patientName = '本地旧姓名';
    await saveCaseToLocalDb(local, 1);

    const remote: SurgeryCase = {
      ...local,
      patientName: '远端新姓名',
      gender: '女',
      operationCase: { operationId: 'case-persist-test', patientName: '远端新姓名', version: 5 },
    };
    const merged = await hydrateAnesthesiaCasesFromLocalDb([remote], { appendOrphans: false });
    expect(merged).toHaveLength(1);
    // 远端主数据胜出（不再因时间戳整对象覆盖）
    expect(merged[0].patientName).toBe('远端新姓名');
    expect(merged[0].gender).toBe('女');
    expect(merged[0].operationCase?.version).toBe(5);
    // 本地临床记录保留
    expect(merged[0].vitals).toHaveLength(1);
    expect(merged[0].medications).toHaveLength(1);
  });

  it('hydrate clears stale local flat fields when remote authoritative master is null', async () => {
    const local = baseCase();
    local.operationCase = { operationId: 'case-persist-test', patientName: '本地旧姓名', version: 1 };
    await saveCaseToLocalDb(local, 1);

    const remote: SurgeryCase = {
      ...local,
      patientName: '远端清空',
      operationCase: {
        operationId: 'case-persist-test',
        patientName: null,
        version: 2,
        sourceSystem: 'HULI',
        sourceTable: 'operatenotice',
      },
    };
    const merged = await hydrateAnesthesiaCasesFromLocalDb([remote], { appendOrphans: false });
    expect(merged).toHaveLength(1);
    // 远端权威 null 覆盖本地旧值，刷新后不再恢复旧姓名
    expect(merged[0].operationCase?.patientName).toBeNull();
    expect(merged[0].operationCase?.version).toBe(2);
    expect(merged[0].patientName).toBe('');
    // 本地临床记录保留
    expect(merged[0].vitals).toHaveLength(1);
  });
});

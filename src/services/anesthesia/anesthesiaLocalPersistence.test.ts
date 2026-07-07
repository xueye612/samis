import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { SurgeryCase } from '@/types/anesthesia';
import { resetAnesthesiaLocalDbForTests } from '@/services/anesthesia/localDb';
import { saveCaseToLocalDb, loadCaseFromLocalDb, loadCurrentPageFromLocalDb } from '@/services/anesthesia/anesthesiaRecordRepository';
import { getPendingSyncCount, listPendingSyncItems } from '@/services/anesthesia/anesthesiaSyncQueue';

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
  events: [],
  medications: [],
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

  it('Slice 3f: record entity enqueue carries casePayload with lists stripped', async () => {
    await saveCaseToLocalDb(baseCase(), 1, {
      entityType: 'record',
      entityLocalId: 'case-persist-test',
      operationType: 'update',
      apiPath: '/api-samis/pc/v1/anesthesiaRecord/saveRecord',
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
      apiPath: '/api-samis/pc/v1/anesthesiaRecord/saveMedication',
    });
    const items = await listPendingSyncItems(50, 'case-persist-test');
    const medItem = items.find((it) => it.entity_type === 'medication');
    expect(medItem).toBeTruthy();
    const payload = JSON.parse(medItem!.payload || '{}');
    expect(payload.casePayload).toBeUndefined();
  });
});

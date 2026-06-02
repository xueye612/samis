import { describe, expect, it, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { SurgeryCase } from '@/types/anesthesia';
import { resetAnesthesiaLocalDbForTests } from '@/services/anesthesia/localDb';
import { saveCaseToLocalDb, loadCaseFromLocalDb, loadCurrentPageFromLocalDb } from '@/services/anesthesia/anesthesiaRecordRepository';
import { getPendingSyncCount } from '@/services/anesthesia/anesthesiaSyncQueue';

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
});

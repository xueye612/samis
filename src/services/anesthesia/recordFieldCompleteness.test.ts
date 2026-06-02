import { describe, expect, it } from 'vitest';
import type { SurgeryCase } from '@/types/anesthesia';
import { buildRecordPendingFields } from './recordFieldCompleteness';

const baseCase = (): SurgeryCase => ({
  id: 'case-1',
  room: 'OR-01',
  sequence: 1,
  patientName: '测试',
  gender: '男',
  age: 50,
  department: '普外',
  diagnosis: '胆囊结石',
  surgeryName: '腹腔镜胆囊切除',
  surgeon: '',
  anesthesiaMethod: '',
  asa: 'II',
  urgency: '择期',
  anesthesiologist: '',
  anesthesiaNurse: '',
  status: '麻醉中',
  locationType: '手术室内',
  plannedStart: '2026-05-30T08:00:00',
  locked: false,
  activeWarming: false,
  autologousBlood: false,
  postoperativeAnalgesia: false,
  preVisit: {
    completed: true,
    height: 170,
    weight: 70,
    asa: 'II',
    allergy: '无',
    anesthesiaHistory: '无',
    difficultAirway: '否',
    fasting: '8小时',
    preMedication: '无',
    specialCondition: '',
    plan: '全麻',
    doctorSignature: '李医生',
  },
  vitals: [],
  events: [],
  medications: [],
  fluids: [],
  outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
});

describe('recordFieldCompleteness', () => {
  it('lists missing header and summary fields', () => {
    const pending = buildRecordPendingFields(baseCase(), {});
    expect(pending.map((item) => item.label)).toEqual(expect.arrayContaining([
      '麻醉医师',
      '手术医师',
      '洗手护士',
      '巡回护士',
    ]));
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildDictionarySummary,
  buildIntraopSnapshots,
  buildPrototypeMetrics,
  qualityExtractionFields,
} from '@/config/anesthesiaPrototype';
import type { PostoperativeFollowUp, SurgeryCase } from '@/types/anesthesia';

const makeCase = (patch: Partial<SurgeryCase>): SurgeryCase => ({
  id: 'case-1',
  room: 'OR-01',
  sequence: 1,
  patientName: '测试患者',
  gender: '男',
  age: 52,
  department: '普外科',
  diagnosis: '胆囊结石',
  surgeryName: '腹腔镜胆囊切除术',
  surgeon: '李医生',
  anesthesiaMethod: '全身麻醉',
  asa: 'II',
  urgency: '择期',
  anesthesiologist: '王睿',
  anesthesiaNurse: '赵护士',
  status: 'PACU',
  locationType: '手术室内',
  plannedStart: '2026-05-31T08:00:00.000Z',
  expectedDurationMinutes: 90,
  locked: false,
  activeWarming: true,
  autologousBlood: false,
  postoperativeAnalgesia: true,
  preVisit: {
    completed: true,
    height: 170,
    weight: 70,
    asa: 'II',
    allergy: '无',
    anesthesiaHistory: '无',
    difficultAirway: '无',
    fasting: '已禁食',
    preMedication: '无',
    specialCondition: '无',
    plan: '全麻',
    doctorSignature: '王睿',
  },
  vitals: [],
  events: [],
  medications: [],
  fluids: [],
  outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
  ...patch,
});

const makeFollowUp = (caseId: string): PostoperativeFollowUp => ({
  id: `fu-${caseId}`,
  caseId,
  type: '术后镇痛随访',
  followTime: '2026-05-31T12:00:00.000Z',
  vas: 3,
  nausea: false,
  headache: false,
  hoarseness: false,
  numbness: false,
  motorDisorder: false,
  awareness: false,
  respiratoryDepression: false,
  reintubation: false,
  transferredIcu: false,
  death: false,
  advice: '继续观察',
});

describe('anesthesia prototype config helpers', () => {
  it('builds quality-oriented metrics from cases and followups', () => {
    const cases = [
      makeCase({
        id: 'case-1',
        medications: [
          { id: 'med-1', mode: '单次用药', time: '2026-05-31T08:10:00.000Z', drug: '芬太尼', dose: 100, unit: 'μg', route: '静脉', executor: '王睿', highAlert: true },
        ],
        fluids: [
          { id: 'fluid-1', category: '晶体液', name: '乳酸钠林格液', startTime: '2026-05-31T08:20:00.000Z', volume: 500, unit: 'ml', executor: '赵护士' },
          { id: 'fluid-2', category: '血液制品', name: '悬浮红细胞', startTime: '2026-05-31T09:20:00.000Z', volume: 2, unit: 'U', executor: '赵护士', doubleCheck: false },
        ],
        vitals: [{ id: 'vital-1', time: '2026-05-31T08:25:00.000Z', HR: 130, SpO2: 98 }],
        events: [{ id: 'event-1', type: '低血压', time: '2026-05-31T08:40:00.000Z', stage: '术中', severity: '中度', treatment: '升压药', staff: ['王睿'], reported: false, qualityIncluded: true }],
      }),
      makeCase({
        id: 'case-2',
        preVisit: {
          completed: false,
          height: 168,
          weight: 60,
          asa: 'III',
          allergy: '',
          anesthesiaHistory: '',
          difficultAirway: '',
          fasting: '',
          preMedication: '',
          specialCondition: '',
          plan: '',
          doctorSignature: '',
        },
        status: '已离室',
        postoperativeAnalgesia: true,
      }),
    ];

    const metrics = buildPrototypeMetrics(cases, [makeFollowUp('case-1')]);

    expect(metrics.preVisitRate).toBe(50);
    expect(metrics.followUpRate).toBe(50);
    expect(metrics.highAlertUncheckedCount).toBe(1);
    expect(metrics.uncheckedBloodProductCount).toBe(1);
    expect(metrics.qualityEventCount).toBe(1);
    expect(metrics.unreportedQualityEventCount).toBe(1);
    expect(metrics.abnormalVitalCount).toBe(1);
    expect(metrics.unhandledAbnormalVitalCount).toBe(1);
    expect(metrics.missingItemCount).toBe(6);
  });

  it('uses configured vital dictionary limits for abnormal statistics', () => {
    const [snapshot] = buildIntraopSnapshots([
      makeCase({
        vitals: [
          { id: 'vital-1', time: '2026-05-31T08:25:00.000Z', HR: 88, abnormalHandled: { HR: '已复测' } },
        ],
      }),
    ], [
      { id: 'vital-1', code: 'V-HR', name: '心率', shortCode: 'HR', unit: 'bpm', lowerLimit: 90, upperLimit: 120, sortOrder: 1, enabled: true },
    ]);

    const metrics = buildPrototypeMetrics([
      makeCase({
        vitals: [
          { id: 'vital-1', time: '2026-05-31T08:25:00.000Z', HR: 88, abnormalHandled: { HR: '已复测' } },
        ],
      }),
    ], [makeFollowUp('case-1')], [
      { id: 'vital-1', code: 'V-HR', name: '心率', shortCode: 'HR', unit: 'bpm', lowerLimit: 90, upperLimit: 120, sortOrder: 1, enabled: true },
    ]);

    expect(snapshot.abnormalVitalCount).toBe(1);
    expect(metrics.abnormalVitalCount).toBe(1);
    expect(metrics.unhandledAbnormalVitalCount).toBe(0);
  });

  it('builds per-case intraoperative snapshots with completion scores', () => {
    const [snapshot] = buildIntraopSnapshots([
      makeCase({
        medications: [{ id: 'med-1', mode: '单次用药', time: '2026-05-31T08:10:00.000Z', drug: '丙泊酚', dose: 120, unit: 'mg', route: '静脉', executor: '王睿', highAlert: true, checker: '赵护士' }],
        fluids: [{ id: 'fluid-1', category: '晶体液', name: '乳酸钠林格液', startTime: '2026-05-31T08:20:00.000Z', volume: 500, unit: 'ml', executor: '赵护士' }],
        vitals: [{ id: 'vital-1', time: '2026-05-31T08:25:00.000Z', HR: 80, SpO2: 99 }],
        events: [],
        outputs: { urine: 100, bloodLoss: 50, drainage: 20 },
      }),
    ]);

    expect(snapshot.medicationCount).toBe(1);
    expect(snapshot.fluidVolume).toBe(500);
    expect(snapshot.outputVolume).toBe(170);
    expect(snapshot.completionScore).toBe(100);
  });

  it('keeps dictionaries and quality fields explicit for UI generation', () => {
    const summary = buildDictionarySummary(
      [{ id: 'drug-1', code: 'PROP', name: '丙泊酚', specification: '200mg/20ml', doseUnit: 'mg', enabled: true }],
      [{ id: 'fluid-1', code: 'RBC', name: '悬浮红细胞', subCategory: '血液制品', enabled: false }],
      [{ id: 'vital-1', code: 'V-HR', name: '心率', shortCode: 'HR', unit: 'bpm', sortOrder: 1, enabled: true }],
      ['低血压'],
    );

    expect(summary.map((item) => item.name)).toEqual(['药品字典', '液体/血制品字典', '生命体征字典', '事件字典']);
    expect(summary[1]).toMatchObject({ count: 1, enabled: 0 });
    expect(qualityExtractionFields.some((item) => item.code === 'QC-MED-001')).toBe(true);
  });
});

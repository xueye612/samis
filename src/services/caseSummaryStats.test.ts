import { describe, expect, it } from 'vitest';
import {
  buildCaseSummaryStats,
  buildEventSummary,
  buildFluidSummary,
  buildMedicationSummary,
  buildQualityCompleteness,
  buildVitalExtremes,
} from '@/services/caseSummaryStats';
import type {
  AnesthesiaEvent,
  FluidRecord,
  MedicationRecord,
  SurgeryCase,
  VitalSign,
} from '@/types/anesthesia';

const medications: MedicationRecord[] = [
  { id: 'm1', mode: '持续泵入', drug: '丙泊酚', dose: 200, unit: 'mg', pumpRate: '10ml/h', drugCategory: '镇静药品', highAlert: true, checker: '李四', executor: '王睿' },
  { id: 'm2', mode: '单次用药', drug: '芬太尼', dose: 0.1, unit: 'mg', drugCategory: '镇痛药品', highAlert: true, executor: '王睿' },
  { id: 'm3', mode: '单次用药', drug: '罗库溴铵', dose: 50, unit: 'mg', drugCategory: '肌松药品', executor: '王睿' },
  { id: 'm4', mode: '单次用药', drug: '昂丹司琼', dose: 4, unit: 'mg', drugCategory: '镇痛药品', executor: '王睿', status: 'voided' },
];

const fluids: FluidRecord[] = [
  { id: 'f1', category: '晶体液', name: '乳酸钠林格', startTime: '2026-05-31T01:00:00.000Z', volume: 1000, unit: 'ml', executor: '王睿' },
  { id: 'f2', category: '胶体液', name: '羟乙基淀粉', startTime: '2026-05-31T01:30:00.000Z', volume: 500, unit: 'ml', executor: '王睿' },
  { id: 'f3', category: '血液制品', name: '红细胞悬液', startTime: '2026-05-31T02:00:00.000Z', volume: 400, unit: 'ml', bloodType: 'A', rh: '+', doubleCheck: true, executor: '王睿' },
  { id: 'f4', category: '血液制品', name: '血浆', startTime: '2026-05-31T02:30:00.000Z', volume: 200, unit: 'ml', bloodType: 'A', rh: '+', doubleCheck: false, reaction: '发热反应', executor: '王睿' },
];

const events: AnesthesiaEvent[] = [
  { id: 'e1', type: '低血压', time: '2026-05-31T01:10:00.000Z', stage: '术中', severity: '中度', treatment: '加快补液并用升压药', staff: ['王睿'], reported: true, qualityIncluded: true },
  { id: 'e2', type: '低体温', time: '2026-05-31T01:40:00.000Z', stage: '术中', severity: '轻度', treatment: '待补记', staff: ['王睿'], reported: false, qualityIncluded: true },
  { id: 'e3', type: '插管', time: '2026-05-31T00:50:00.000Z', stage: '诱导期', severity: '轻度', treatment: '可视喉镜顺利插管', staff: ['王睿'], reported: false, qualityIncluded: false },
  { id: 'e4', type: '作废事件', time: '2026-05-31T00:55:00.000Z', stage: '诱导期', severity: '轻度', treatment: '', staff: ['王睿'], reported: false, qualityIncluded: false, status: 'voided' },
];

const vitals: VitalSign[] = [
  { id: 'v1', time: '2026-05-31T01:00:00.000Z', HR: 72, SBP: 120, SpO2: 99, TEMP: 36.5 },
  { id: 'v2', time: '2026-05-31T01:30:00.000Z', HR: 88, SBP: 95, SpO2: 97, TEMP: 35.6 },
  { id: 'v3', time: '2026-05-31T02:00:00.000Z', HR: 65, SBP: 110, SpO2: 100, TEMP: 36.1 },
];

function buildCase(overrides: Partial<SurgeryCase> = {}): SurgeryCase {
  return {
    id: 'case-1',
    room: 'OR-01',
    sequence: 1,
    patientName: '张三',
    gender: '男',
    age: 50,
    department: '普外科',
    diagnosis: '胆囊结石',
    surgeryName: '腹腔镜胆囊切除',
    surgeon: '赵医生',
    anesthesiaMethod: '全身麻醉',
    asa: 'II',
    urgency: '择期',
    anesthesiologist: '王睿',
    anesthesiaNurse: '孙护士',
    status: '已离室',
    locationType: '手术室内',
    plannedStart: '2026-05-31T00:30:00.000Z',
    anesthesiaStart: '2026-05-31T00:45:00.000Z',
    anesthesiaEnd: '2026-05-31T03:15:00.000Z',
    surgeryStart: '2026-05-31T01:00:00.000Z',
    surgeryEnd: '2026-05-31T03:00:00.000Z',
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
      difficultAirway: '无',
      fasting: '禁食8h',
      preMedication: '无',
      specialCondition: '无',
      plan: '全麻',
      doctorSignature: '王睿',
    },
    vitals,
    events,
    medications,
    fluids,
    outputs: { urine: 300, bloodLoss: 150, drainage: 50 },
    ...overrides,
  } as SurgeryCase;
}

describe('caseSummaryStats - medication', () => {
  it('aggregates medications by category and ignores voided rows', () => {
    const summary = buildMedicationSummary(medications);
    expect(summary.total).toBe(3);
    expect(summary.continuousCount).toBe(1);
    expect(summary.singleCount).toBe(2);
    expect(summary.highAlertCount).toBe(2);
    expect(summary.uncheckedHighAlertCount).toBe(1);
    const sedation = summary.categories.find((item) => item.category === '镇静药品');
    expect(sedation?.count).toBe(1);
    expect(summary.categories.some((item) => item.category === '镇痛药品' && item.count === 1)).toBe(true);
  });
});

describe('caseSummaryStats - fluid', () => {
  it('splits volumes by category and detects unchecked blood and reactions', () => {
    const summary = buildFluidSummary(fluids);
    expect(summary.crystalloidVolume).toBe(1000);
    expect(summary.colloidVolume).toBe(500);
    expect(summary.bloodVolume).toBe(600);
    expect(summary.infusionVolume).toBe(1500);
    expect(summary.intakeVolume).toBe(2100);
    expect(summary.bloodProductCount).toBe(2);
    expect(summary.uncheckedBloodCount).toBe(1);
    expect(summary.transfusionReactionCount).toBe(1);
  });
});

describe('caseSummaryStats - events', () => {
  it('computes treatment completion and excludes voided events', () => {
    const summary = buildEventSummary(events);
    expect(summary.total).toBe(3);
    expect(summary.qualityCount).toBe(2);
    expect(summary.withoutTreatmentCount).toBe(1);
    expect(summary.treatmentRate).toBe(67);
    expect(summary.items[0].iso <= summary.items[summary.items.length - 1].iso).toBe(true);
  });
});

describe('caseSummaryStats - vitals', () => {
  it('computes min/max extremes and lowest temperature', () => {
    const extremes = buildVitalExtremes(vitals);
    expect(extremes.HR).toEqual({ min: 65, max: 88 });
    expect(extremes.SBP.min).toBe(95);
    expect(extremes.hasTemperature).toBe(true);
    expect(extremes.lowestTemp).toBe(35.6);
  });

  it('reports missing temperature when no TEMP recorded', () => {
    const extremes = buildVitalExtremes([{ id: 'x', time: '2026-05-31T01:00:00.000Z', HR: 70 }]);
    expect(extremes.hasTemperature).toBe(false);
    expect(extremes.lowestTemp).toBeUndefined();
  });
});

describe('caseSummaryStats - quality completeness', () => {
  it('flags unchecked blood, missing treatment and unsigned summary', () => {
    const stats = buildCaseSummaryStats(buildCase(), { summarySigned: false });
    const quality = stats.quality;
    const byKey = Object.fromEntries(quality.items.map((item) => [item.key, item.level]));
    expect(byKey.temperature).toBe('ok');
    expect(byKey.highAlert).toBe('warn');
    expect(byKey.bloodDoubleCheck).toBe('warn');
    expect(byKey.eventTreatment).toBe('warn');
    expect(byKey.summarySigned).toBe('warn');
    expect(quality.missingCount).toBeGreaterThan(0);
    expect(quality.completionRate).toBeLessThan(100);
  });

  it('treats categories with no data as not-applicable', () => {
    const cleanCase = buildCase({ medications: [], fluids: [], events: [] });
    const stats = buildCaseSummaryStats(cleanCase);
    const byKey = Object.fromEntries(stats.quality.items.map((item) => [item.key, item.level]));
    expect(byKey.highAlert).toBe('na');
    expect(byKey.bloodDoubleCheck).toBe('na');
    expect(byKey.eventTreatment).toBe('na');
  });
});

describe('caseSummaryStats - aggregate', () => {
  it('computes balance and durations', () => {
    const stats = buildCaseSummaryStats(buildCase());
    expect(stats.balance.intake).toBe(2100);
    expect(stats.balance.output).toBe(500);
    expect(stats.balance.net).toBe(1600);
    expect(stats.anesthesiaDurationMinutes).toBe(150);
    expect(stats.surgeryDurationMinutes).toBe(120);
  });
});

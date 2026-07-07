import { describe, expect, it } from 'vitest';
import type { SurgeryCase } from '@/types/anesthesia';
import {
  buildCasePayload,
  CASE_LIST_FIELDS,
  isCaseListField,
} from '@/services/anesthesia/casePayload';
import {
  reconstructCaseFromRecordDetail,
  type RecordDetailRecord,
} from '@/services/anesthesia/anesthesiaRecordHydrate';

const baseCase = (): SurgeryCase => ({
  id: 'case-payload-test',
  room: 'OR-01',
  sequence: 1,
  patientName: '回读患者',
  gender: '男',
  age: 55,
  department: '麻醉科',
  diagnosis: '阑尾炎',
  surgeryName: '阑尾切除术',
  surgeon: '陈医生',
  anesthesiaMethod: '全身麻醉',
  asa: 'II',
  urgency: '择期',
  anesthesiologist: '王医生',
  anesthesiaNurse: '张护士',
  status: '手术中',
  locationType: '手术室内',
  plannedStart: '2026-07-05T08:00:00.000Z',
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
  vitals: [{ id: 'v1', time: '2026-07-05T09:00:00.000Z', HR: 80, SBP: 120, DBP: 70, SpO2: 99, source: '手工录入' }],
  events: [{ id: 'e1', type: '诱导', time: '2026-07-05T09:05:00.000Z', stage: '诱导期', severity: '轻度', treatment: '', staff: [], reported: false, qualityIncluded: false }],
  medications: [{ id: 'm1', mode: '单次用药', drug: '丙泊酚', dose: 2, unit: 'mg/kg', executor: '王医生' }],
  fluids: [{ id: 'f1', category: '晶体液', name: '生理盐水', startTime: '2026-07-05T09:00:00.000Z', volume: 500, unit: 'ml', executor: '张护士' }],
  outputs: { urine: 100, bloodLoss: 20, drainage: 0 },
  outputRecords: [{ id: 'o1', time: '2026-07-05T10:00:00.000Z', type: '尿量', volume: 100 }],
  labResults: [],
});

describe('buildCasePayload (Slice 3f)', () => {
  it('strips all list arrays that have dedicated sub-tables', () => {
    const payload = buildCasePayload(baseCase());
    for (const key of CASE_LIST_FIELDS) {
      expect(payload[key]).toBeUndefined();
    }
  });

  it('keeps case-level nested objects and scalars', () => {
    const item = baseCase();
    item.airwayRecord = { airwayMethod: '气管插管', tubeModel: '7.0' };
    item.rescue = { startTime: '2026-07-05T09:30:00.000Z', measures: '心肺复苏', medications: '', participants: [], supplementReminder: false };
    const payload = buildCasePayload(item);
    expect(payload.preVisit).toEqual(item.preVisit);
    expect(payload.airwayRecord).toEqual(item.airwayRecord);
    expect(payload.rescue).toEqual(item.rescue);
    expect(payload.outputs).toEqual(item.outputs);
    expect(payload.patientName).toBe('回读患者');
  });

  it('does NOT strip transfusionEvents / ioRecords (no dedicated sub-table)', () => {
    const item = baseCase();
    item.transfusionEvents = [{ id: 'te1', bloodProduct: '红细胞', amount: 2, amountUnit: 'U', startTime: '2026-07-05T10:00:00.000Z', status: 'active' }];
    item.ioRecords = [{ id: 'ir1', recordTime: '2026-07-05T10:00:00.000Z', ioDirection: 'input', ioType: '晶体液', name: '生理盐水', volume: 500, unit: 'ml', isCountTotal: true, status: 'active' }];
    const payload = buildCasePayload(item);
    expect(payload.transfusionEvents).toEqual(item.transfusionEvents);
    expect(payload.ioRecords).toEqual(item.ioRecords);
  });

  it('isCaseListField flags exactly the stripped keys', () => {
    expect(isCaseListField('vitals')).toBe(true);
    expect(isCaseListField('events')).toBe(true);
    expect(isCaseListField('medications')).toBe(true);
    expect(isCaseListField('fluids')).toBe(true);
    expect(isCaseListField('outputRecords')).toBe(true);
    expect(isCaseListField('labResults')).toBe(true);
    expect(isCaseListField('transfusionEvents')).toBe(false);
    expect(isCaseListField('ioRecords')).toBe(false);
    expect(isCaseListField('outputs')).toBe(false);
    expect(isCaseListField('preVisit')).toBe(false);
  });
});

describe('reconstructCaseFromRecordDetail (Slice 3f)', () => {
  const detail = (): RecordDetailRecord => ({
    localId: 'rec-1',
    serverId: '101',
    recordStatus: 'recording',
    syncVersion: 5,
    recordLocked: false,
    recordPrinted: false,
    anesthesiaMethod: '全身麻醉',
    casePayload: {
      id: 'case-payload-test',
      patientName: '服务端患者',
      gender: '女',
      age: 60,
      preVisit: {
        completed: true, height: 160, weight: 55, asa: 'III', allergy: '青霉素',
        anesthesiaHistory: '', difficultAirway: '', fasting: '6h', preMedication: '',
        specialCondition: '', plan: '全麻', doctorSignature: '刘医生',
      },
      outputs: { urine: 200, bloodLoss: 30, drainage: 10 },
      airwayRecord: { airwayMethod: '气管插管', tubeDepth: '23cm' },
    },
    medications: [
      { localId: 'm1', drugName: '丙泊酚', dose: 2, doseUnit: 'mg/kg', mode: 'single', executor: '王医生', eventTime: '2026-07-05T09:05:00.000Z', status: 'active' },
    ],
    timelineEvents: [
      { localId: 'e1', eventType: '诱导', eventTime: '2026-07-05T09:05:00.000Z', stage: '诱导期', severity: '轻度', status: 'active' },
    ],
    vitalSigns: [
      { localId: 'v1', time: '2026-07-05T09:00:00.000Z', HR: 80, SBP: 120, DBP: 70, SpO2: 99, isCorrected: false },
    ],
    fluids: [
      { localId: 'f1', fluidName: '生理盐水', category: '晶体液', volume: 500, unit: 'ml', startTime: '2026-07-05T09:00:00.000Z', status: 'active' },
    ],
    transfusions: [
      { localId: 't1', productName: '红细胞', volume: 300, unit: 'ml', startTime: '2026-07-05T10:00:00.000Z', status: 'active' },
    ],
    ioRecords: [
      { localId: 'o1', ioType: '尿量', volume: 200, unit: 'ml', measureTime: '2026-07-05T10:00:00.000Z', status: 'active' },
      { localId: 'o2', ioType: '出血量', volume: 30, unit: 'ml', measureTime: '2026-07-05T10:00:00.000Z', status: 'active' },
    ],
    labResults: [
      { localId: 'l1', itemName: 'Hb', value: '110', unit: 'g/L', measureTime: '2026-07-05T10:00:00.000Z', status: 'active' },
    ],
  });

  it('merges casePayload + seed defaults + aggregated lists', () => {
    const reconstructed = reconstructCaseFromRecordDetail(detail(), baseCase());
    expect(reconstructed.id).toBe('case-payload-test');
    // casePayload 提供标量+嵌套对象
    expect(reconstructed.patientName).toBe('服务端患者');
    expect(reconstructed.preVisit?.asa).toBe('III');
    expect(reconstructed.outputs?.urine).toBe(200);
    expect(reconstructed.airwayRecord?.tubeDepth).toBe('23cm');
    // 关系列表填回
    expect(reconstructed.vitals).toHaveLength(1);
    expect(reconstructed.vitals[0].HR).toBe(80);
    expect(reconstructed.medications).toHaveLength(1);
    expect(reconstructed.medications[0].drug).toBe('丙泊酚');
    expect(reconstructed.medications[0].mode).toBe('单次用药');
    expect(reconstructed.events).toHaveLength(1);
    // 输血合并为血液制品 FluidRecord
    expect(reconstructed.fluids.some((f) => f.category === '血液制品' && f.name === '红细胞')).toBe(true);
    expect(reconstructed.fluids.some((f) => f.category === '晶体液')).toBe(true);
    // io_record → outputRecords（仅 尿量/出血量/引流量/其他）
    expect(reconstructed.outputRecords).toHaveLength(2);
    expect(reconstructed.labResults).toHaveLength(1);
  });

  it('R6: null casePayload falls back to seed header; lists still reconstruct', () => {
    const d = detail();
    d.casePayload = null;
    const reconstructed = reconstructCaseFromRecordDetail(d, baseCase());
    // 表头来自 seed
    expect(reconstructed.patientName).toBe('回读患者');
    // 列表仍来自聚合
    expect(reconstructed.vitals).toHaveLength(1);
    expect(reconstructed.medications).toHaveLength(1);
    expect(reconstructed.outputRecords).toHaveLength(2);
  });

  it('locks to read-only when recordLocked=true', () => {
    const d = detail();
    d.recordLocked = true;
    const reconstructed = reconstructCaseFromRecordDetail(d, baseCase());
    expect(reconstructed.locked).toBe(true);
  });

  it('sorts vitals by time', () => {
    const d = detail();
    d.vitalSigns = [
      { localId: 'v2', time: '2026-07-05T10:00:00.000Z', HR: 90 },
      { localId: 'v1', time: '2026-07-05T09:00:00.000Z', HR: 80 },
    ];
    const reconstructed = reconstructCaseFromRecordDetail(d, baseCase());
    expect(reconstructed.vitals[0].id).toBe('v1');
    expect(reconstructed.vitals[1].id).toBe('v2');
  });
});

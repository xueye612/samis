import { describe, expect, it } from 'vitest';
import {
  buildMasterDataChangesFromDiff,
  buildMasterDataUpdateEnvelope,
  buildSaveNursePbPayload,
  mapNursePbRow,
  nursePbDateRange,
  surgeryCaseToOperationUpdatePayload,
} from '@/services/anesthesia/scheduleService';
import type { SurgeryCase } from '@/types/anesthesia';

const minimalCase = (): SurgeryCase => ({
  id: 'op-1',
  room: 'OR-01',
  sequence: 2,
  patientName: '测试',
  gender: '男',
  age: 30,
  department: '外科',
  diagnosis: '诊断',
  surgeryName: '手术',
  surgeon: '张',
  anesthesiaMethod: '全麻',
  asa: 'II',
  urgency: '择期',
  anesthesiologist: '王睿',
  anesthesiaNurse: '陈洁',
  status: '待入室',
  locationType: '手术室内',
  plannedStart: '2026-06-02T08:00:00.000Z',
  expectedDurationMinutes: 60,
  locked: false,
  activeWarming: false,
  autologousBlood: false,
  postoperativeAnalgesia: false,
  preVisit: {
    completed: false,
    height: 170,
    weight: 65,
    asa: 'II',
    allergy: '无',
    anesthesiaHistory: '',
    difficultAirway: '',
    fasting: '',
    preMedication: '',
    specialCondition: '',
    plan: '',
    doctorSignature: '',
  },
  vitals: [{ time: '2026-06-02T08:05:00.000Z', HR: 80 }],
  events: [],
  medications: [{ id: 'm1', mode: '单次用药', drug: '丙泊酚', executor: '陈' }],
  fluids: [],
  outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
});

describe('scheduleService', () => {
  it('mapNursePbRow maps OPERATIONID alias', () => {
    const row = mapNursePbRow({
      OPERATIONID: 'op-99',
      numberOfStations: 3,
      anesthesiologist: '李',
      nurse: '赵',
    });
    expect(row.operationId).toBe('op-99');
    expect(row.numberOfStations).toBe(3);
    expect(row.anesthesiologist).toBe('李');
    expect(row.nurse).toBe('赵');
  });

  it('buildSaveNursePbPayload excludes clinical arrays', () => {
    const payload = buildSaveNursePbPayload(minimalCase(), '2026-06-02');
    expect(payload.operationId).toBe('op-1');
    expect(payload.anesthesiologist).toBe('王睿');
    expect(payload).not.toHaveProperty('vitals');
    expect(payload).not.toHaveProperty('medications');
  });

  it('surgeryCaseToOperationUpdatePayload includes Apifox uppercase fields', () => {
    const payload = surgeryCaseToOperationUpdatePayload(minimalCase());
    expect(payload.OPERATINGROOM_CODE).toBe('OR-01');
    expect(payload.NUMBER_OF_STATIONS).toBe(2);
    expect(payload.PATIENT_HEIGHT).toBe(170);
    expect(payload.PATIENT_WEIGHT).toBe(65);
  });

  it('nursePbDateRange uses same day for start and end', () => {
    expect(nursePbDateRange('2026-06-02')).toEqual({
      startTime: '2026-06-02',
      endTime: '2026-06-02',
    });
  });

  it('buildMasterDataUpdateEnvelope produces controlled envelope with canonical changes and legacy compat', () => {
    const item = minimalCase();
    item.operationCase = { operationId: 'op-1', version: 6 };
    const envelope = buildMasterDataUpdateEnvelope(item, '  修正患者姓名  ', [
      { field: 'patientName', value: '新姓名' },
      { field: 'gender', value: '女' },
    ]);
    expect(envelope.operationId).toBe('op-1');
    expect(envelope.expectedVersion).toBe(6);
    expect(envelope.reason).toBe('修正患者姓名');
    expect(envelope.changes).toEqual([
      { field: 'patientName', value: '新姓名' },
      { field: 'gender', value: '女' },
    ]);
    // 兼容旧后端平铺字段保留
    expect(envelope.OPERATINGROOM_CODE).toBe('OR-01');
    expect(envelope.NUMBER_OF_STATIONS).toBe(2);
  });

  it('buildMasterDataUpdateEnvelope reports null expectedVersion when operationCase version absent', () => {
    const envelope = buildMasterDataUpdateEnvelope(minimalCase(), '原因', []);
    expect(envelope.expectedVersion).toBeNull();
  });

  it('buildMasterDataChangesFromDiff only emits actually changed controlled fields', () => {
    const original = minimalCase();
    const current = minimalCase();
    current.patientName = '新姓名';
    current.surgeon = '新主刀';
    // 未变化字段不出现在 diff
    const changes = buildMasterDataChangesFromDiff(original, current);
    const fields = changes.map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(['patientName', 'operatorName']));
    expect(fields).not.toContain('gender');
    expect(changes.find((c) => c.field === 'patientName')?.value).toBe('新姓名');
    expect(changes.find((c) => c.field === 'operatorName')?.value).toBe('新主刀');
  });
});

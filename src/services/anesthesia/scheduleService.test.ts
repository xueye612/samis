import { describe, expect, it } from 'vitest';
import {
  buildMasterDataChangesFromDiff,
  buildMasterDataUpdateEnvelope,
  buildSaveNursePbPayload,
  formatScheduleRange,
  mapNursePbRow,
  mergeNurseScheduleIntoCases,
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

  it('maps the real operation_pb_nurse date, room and personnel columns', () => {
    const row = mapNursePbRow({
      start_date: '2026-07-16',
      end_date: '2026-07-16',
      OPERATINGROOM_CODE: 'A1',
      OPERATINGROOM_NAME: '一号手术间',
      ANESTHETIST_PB_NAME: '王医生',
      CIRCULATINGNURSE_NAME: '李护士',
      SCRUBNURSE_NAME: '周护士',
    });

    expect(row).toMatchObject({
      startDate: '2026-07-16',
      endDate: '2026-07-16',
      roomCode: 'A1',
      roomName: '一号手术间',
      anesthesiologist: '王医生',
      circulatingNurse: '李护士',
      scrubNurse: '周护士',
    });
  });

  it('buildSaveNursePbPayload excludes clinical arrays', () => {
    const payload = buildSaveNursePbPayload(minimalCase(), '2026-06-02');
    expect(payload).toEqual({
      time: '2026-06-02',
      start_date: '2026-06-02',
      end_date: '2026-06-02',
      OPERATINGROOM_CODE: 'OR-01',
      OPERATINGROOM_NAME: 'OR-01',
      ANESTHETIST_PB_CODE: '',
      ANESTHETIST_PB_NAME: '王睿',
      CIRCULATINGNURSE_CODE: '',
      CIRCULATINGNURSE_NAME: '',
      SCRUBNURSE_CODE: '',
      SCRUBNURSE_NAME: '',
    });
    expect(payload).not.toHaveProperty('vitals');
    expect(payload).not.toHaveProperty('medications');
  });

  it('augments personnel by operation id or date plus room without changing room or sequence', () => {
    const a1 = minimalCase();
    a1.id = 'op-a1';
    a1.room = 'A1';
    a1.roomId = 'A1';
    a1.roomName = '一号手术间';
    a1.sequence = 3;
    a1.operationCase = { operationId: 'op-a1', operationDate: '2026-07-16', roomCode: 'A1' };
    const b2 = minimalCase();
    b2.id = 'op-b2';
    b2.room = 'B2';
    b2.roomId = 'B2';
    b2.operationCase = { operationId: 'op-b2', operationDate: '2026-07-16', roomCode: 'B2' };

    const merged = mergeNurseScheduleIntoCases([a1, b2], [{
      operationId: '',
      startDate: '2026-07-16',
      endDate: '2026-07-16',
      roomCode: 'A1',
      roomName: '错误房间名称不能覆盖病例',
      room: 'A1',
      numberOfStations: 99,
      anesthesiologist: '护理排班麻醉人员',
      circulatingNurse: '巡回护士',
      scrubNurse: '洗手护士',
    }]);

    expect(merged[0]).toMatchObject({
      room: 'A1', roomId: 'A1', roomName: '一号手术间', sequence: 3,
      anesthesiologist: '护理排班麻醉人员', circulatingNurses: '巡回护士', scrubNurses: '洗手护士',
    });
    expect(merged[1]).toMatchObject({ room: 'B2', anesthesiologist: '王睿' });
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

  it('formatScheduleRange rejects zero dates and derives a valid end time', () => {
    const item = minimalCase();
    item.scheduledStart = '2026-07-16 09:25:00';
    item.scheduledEnd = '0000-00-00 00:00:00';
    item.expectedDurationMinutes = 90;
    expect(formatScheduleRange(item)).toBe('09:25 - 10:55');
  });

  it('formatScheduleRange combines time-only values with operation date', () => {
    const item = minimalCase();
    item.operationCase = { operationId: item.id, operationDate: '2026-07-16' };
    item.scheduledStart = '09:25';
    item.scheduledEnd = '11:10';
    expect(formatScheduleRange(item)).toBe('09:25 - 11:10');
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

  it('buildMasterDataChangesFromDiff emits age/plannedStartTime/plannedEndTime changes', () => {
    const original = minimalCase();
    const current = minimalCase();
    current.age = 45;
    current.scheduledStart = '2026-07-13T09:00:00.000Z';
    current.scheduledEnd = '2026-07-13T11:00:00.000Z';
    const fields = buildMasterDataChangesFromDiff(original, current).map((c) => c.field).sort();
    expect(fields).toEqual(['age', 'plannedEndTime', 'plannedStartTime']);
  });
});

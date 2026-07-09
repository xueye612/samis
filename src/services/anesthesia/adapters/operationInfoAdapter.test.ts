import { describe, expect, it } from 'vitest';
import {
  buildNursePbListQuery,
  buildOperationListQuery,
  mapOperationListResponse,
  mapWorkbenchResponse,
  mapOperationDetail,
  mapOperationListItem,
  mergeOperationIntoCase,
  shouldSkipRemoteOperationRefresh,
} from '@/services/anesthesia/adapters/operationInfoAdapter';
import type { SurgeryCase } from '@/types/anesthesia';

describe('operationInfoAdapter', () => {
  it('maps list item with OPERATIONID alias', () => {
    const item = mapOperationListItem({
      OPERATIONID: 'op-100',
      PATIENTNAME: '张三',
      ROOMNAME: 'OR-02',
      numberOfStations: 3,
      OPERATIONNAME: '阑尾切除',
    });
    expect(item.id).toBe('op-100');
    expect(item.patientName).toBe('张三');
    expect(item.room).toBe('OR-02');
    expect(item.sequence).toBe(3);
    expect(item.surgeryName).toBe('阑尾切除');
  });

  it('prefers operationCase and operationTimeline fields over legacy flat fields', () => {
    const [item] = mapOperationListResponse({
      list: [{
        OPERATIONID: 'legacy-op',
        PATIENTNAME: '旧患者',
        ROOMNAME: '旧手术间',
        OPERATIONNAME: '旧手术',
        PLANNING_BEGINTIME: '2026-01-01T07:30:00.000Z',
        FIRST_SCANNING: '2026-01-01T07:40:00.000Z',
        ANESTHESIA_START_TIME: '2026-01-01T07:45:00.000Z',
        OPERATION_START_TIME: '2026-01-01T08:20:00.000Z',
        LAST_SCANNING: '2026-01-01T10:00:00.000Z',
        operationCase: {
          operationId: 'case-op',
          patientName: '新患者',
          roomName: '新手术间',
          operationName: '新手术',
          departmentName: '新科室',
          sequence: 5,
          plannedStartTime: '2026-01-01T08:00:00.000Z',
        },
        operationTimeline: {
          inRoomTime: '2026-01-01T08:05:00.000Z',
          anesthesiaStartTime: '2026-01-01T08:10:00.000Z',
          operationStartTime: '2026-01-01T08:30:00.000Z',
          operationEndTime: '2026-01-01T09:30:00.000Z',
          outRoomTime: '2026-01-01T09:45:00.000Z',
        },
      }],
    });

    expect(item.id).toBe('case-op');
    expect(item.patientName).toBe('新患者');
    expect(item.room).toBe('新手术间');
    expect(item.sequence).toBe(5);
    expect(item.department).toBe('新科室');
    expect(item.surgeryName).toBe('新手术');
    expect(item.plannedStart).toBe('2026-01-01T08:00:00.000Z');
    expect(item.actualStart).toBe('2026-01-01T08:05:00.000Z');
    expect(item.anesthesiaStart).toBe('2026-01-01T08:10:00.000Z');
    expect(item.surgeryStart).toBe('2026-01-01T08:30:00.000Z');
    expect(item.surgeryEnd).toBe('2026-01-01T09:30:00.000Z');
    expect(item.leaveRoomTime).toBe('2026-01-01T09:45:00.000Z');
  });

  it('falls back to legacy fields when operationCase or operationTimeline are absent', () => {
    const item = mapOperationListItem({
      OPERATIONID: 'legacy-op',
      PATIENTNAME: '旧患者',
      ROOMNAME: '旧手术间',
      OPERATIONNAME: '旧手术',
      NUMBER_OF_STATIONS: '2',
      PLANNING_BEGINTIME: '2026-01-01T07:30:00.000Z',
      FIRST_SCANNING: '2026-01-01T07:40:00.000Z',
      ANESTHESIA_START_TIME: '2026-01-01T07:45:00.000Z',
      OPERATION_START_TIME: '2026-01-01T08:20:00.000Z',
    });

    expect(item.id).toBe('legacy-op');
    expect(item.patientName).toBe('旧患者');
    expect(item.room).toBe('旧手术间');
    expect(item.sequence).toBe(2);
    expect(item.surgeryName).toBe('旧手术');
    expect(item.plannedStart).toBe('2026-01-01T07:30:00.000Z');
    expect(item.actualStart).toBe('2026-01-01T07:40:00.000Z');
    expect(item.anesthesiaStart).toBe('2026-01-01T07:45:00.000Z');
    expect(item.surgeryStart).toBe('2026-01-01T08:20:00.000Z');
  });

  it('maps today workbench rows when operationTimeline omits optional timeline fields', () => {
    const result = mapWorkbenchResponse({
      todayCases: [{
        OPERATIONID: 'op-workbench',
        operationCase: {
          patientName: '工作台患者',
          roomName: 'OR-05',
          operationName: '胆囊切除',
        },
        operationTimeline: {
          inRoomTime: '2026-01-01T08:05:00.000Z',
        },
      }],
      roomStatus: [{ roomId: 'OR-05', busy: true, count: 1 }],
      summary: { surgeries: 1, busyRooms: 1, roomCount: 1 },
    });

    expect(result.cases).toHaveLength(1);
    expect(result.cases[0].id).toBe('op-workbench');
    expect(result.cases[0].patientName).toBe('工作台患者');
    expect(result.cases[0].room).toBe('OR-05');
    expect(result.cases[0].actualStart).toBe('2026-01-01T08:05:00.000Z');
    expect(result.cases[0].anesthesiaStart).toBeUndefined();
    expect(result.summary.surgeries).toBe(1);
  });

  it('merges detail responses from operationCase and operationTimeline into an existing case', () => {
    const existing = mapOperationListItem({
      OPERATIONID: 'op-detail',
      PATIENTNAME: '旧详情患者',
      ROOMNAME: 'OR-01',
      OPERATIONNAME: '旧详情手术',
    });
    const detail = mapOperationDetail({
      OPERATIONID: 'op-detail',
      operationCase: {
        patientName: '详情患者',
        departmentName: '普外科',
        operationName: '腹腔镜胆囊切除',
        anesthesiologistName: '麻醉医生甲',
      },
      operationTimeline: {
        anesthesiaStartTime: '2026-01-01T08:10:00.000Z',
        operationStartTime: '2026-01-01T08:30:00.000Z',
      },
    });

    const merged = mergeOperationIntoCase(existing, detail);

    expect(merged.id).toBe('op-detail');
    expect(merged.patientName).toBe('详情患者');
    expect(merged.department).toBe('普外科');
    expect(merged.surgeryName).toBe('腹腔镜胆囊切除');
    expect(merged.anesthesiologist).toBe('麻醉医生甲');
    expect(merged.anesthesiaStart).toBe('2026-01-01T08:10:00.000Z');
    expect(merged.surgeryStart).toBe('2026-01-01T08:30:00.000Z');
  });

  it('merges detail without touching clinical arrays', () => {
    const existing: SurgeryCase = {
      id: 'op-1',
      room: 'OR-01',
      sequence: 1,
      patientName: '旧名',
      gender: '男',
      age: 40,
      department: '外科',
      diagnosis: '旧诊断',
      surgeryName: '旧手术',
      surgeon: '李',
      anesthesiaMethod: '全麻',
      asa: 'II',
      urgency: '择期',
      anesthesiologist: '王',
      anesthesiaNurse: '陈',
      status: '麻醉中',
      locationType: '手术室内',
      plannedStart: new Date().toISOString(),
      expectedDurationMinutes: 60,
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
        anesthesiaHistory: '',
        difficultAirway: '',
        fasting: '',
        preMedication: '',
        specialCondition: '',
        plan: '',
        doctorSignature: '',
      },
      vitals: [{ time: new Date().toISOString(), HR: 80 }],
      events: [],
      medications: [{ id: 'm1', mode: '单次用药', drug: '丙泊酚', executor: '陈' }],
      fluids: [],
      outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
    };
    const detail = mapOperationDetail({
      operationId: 'op-1',
      patientName: '新名',
      diagnosis: '新诊断',
    });
    const merged = mergeOperationIntoCase(existing, detail);
    expect(merged.patientName).toBe('新名');
    expect(merged.diagnosis).toBe('新诊断');
    expect(merged.vitals).toHaveLength(1);
    expect(merged.medications).toHaveLength(1);
  });

  it('buildOperationListQuery sets operationRoom from room filter', () => {
    const query = buildOperationListQuery({ operationDate: '2026-06-02', room: 'OR-03' });
    expect(query).toContain('operationDate=2026-06-02');
    expect(query).toContain('operationRoom=OR-03');
    expect(query).toContain('room=OR-03');
  });

  it('buildNursePbListQuery requires start and end date', () => {
    const query = buildNursePbListQuery({ startTime: '2026-06-02', endTime: '2026-06-02' });
    expect(query).toBe('startTime=2026-06-02&endTime=2026-06-02');
  });

  it('skips remote refresh when locked or printed', () => {
    expect(shouldSkipRemoteOperationRefresh({ locked: true } as SurgeryCase)).toBe(true);
    expect(shouldSkipRemoteOperationRefresh({ printedAt: '2026-01-01' } as SurgeryCase)).toBe(true);
    expect(shouldSkipRemoteOperationRefresh({ locked: false } as SurgeryCase)).toBe(false);
  });
});

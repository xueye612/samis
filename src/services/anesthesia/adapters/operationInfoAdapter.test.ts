import { describe, expect, it } from 'vitest';
import {
  buildNursePbListQuery,
  buildOperationListQuery,
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

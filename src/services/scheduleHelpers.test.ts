import { describe, expect, it } from 'vitest';
import { anesthesiaCases } from '@/mock/anesthesiaCases';
import type { SurgeryCase } from '@/types/anesthesia';
import {
  dedupeCasesByOperationId,
  getDoctorCases,
  groupCasesByRoom,
  normalizeCaseSchedule,
  summarizeRoomAssignments,
} from '@/services/scheduleHelpers';

describe('scheduleHelpers', () => {
  it('normalizes surgery nursing schedule fields without duplicating patient data', () => {
    const item = anesthesiaCases[0];
    const normalized = normalizeCaseSchedule(item);

    expect(normalized.caseId).toBe(item.id);
    expect(normalized.patientId).toBeTruthy();
    expect(normalized.roomId).toBe(item.room);
    expect(normalized.source).toContain('手术护理系统');
  });

  it('filters current anesthesiologist cases across multiple rooms and emergency insertions', () => {
    const wangCases = getDoctorCases(anesthesiaCases, '王睿');
    const rooms = new Set(wangCases.map((item) => item.room));

    expect(wangCases.length).toBeGreaterThanOrEqual(3);
    expect(rooms.has('OR-01')).toBe(true);
    expect(rooms.has('OR-02')).toBe(true);
    expect(wangCases.some((item) => item.emergencyInserted || item.urgency === '急诊')).toBe(true);
  });

  it('does not throw when schedule times are missing or invalid', () => {
    const normalized = normalizeCaseSchedule({
      ...anesthesiaCases[0],
      scheduledStart: undefined,
      plannedStart: undefined,
      scheduledEnd: undefined,
      surgeryEnd: undefined,
      leaveRoomTime: undefined,
    } as unknown as typeof anesthesiaCases[number]);
    expect(normalized.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(normalized.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isNaN(Date.parse(normalized.startTime))).toBe(false);
    expect(Number.isNaN(Date.parse(normalized.endTime))).toBe(false);
  });

  it('groups operating rooms with stable room identities', () => {
    const groups = groupCasesByRoom(anesthesiaCases, ['OR-01', 'OR-02', 'OR-03']);

    expect(groups.length).toBeGreaterThanOrEqual(3);
    expect(groups[0].roomId).toBe('OR-01');
    expect(groups.every((item) => Array.isArray(item.cases))).toBe(true);
    expect(groups.flatMap((item) => item.cases)).toHaveLength(anesthesiaCases.length);
  });

  it('keeps every configured or assigned room code instead of limiting rooms to OR prefix', () => {
    const cases = [
      { ...anesthesiaCases[0], id: 'case-a1', room: 'A1', roomId: 'A1', roomName: 'A1' },
      { ...anesthesiaCases[0], id: 'case-b2', room: 'B2', roomId: 'B2', roomName: 'B2' },
      { ...anesthesiaCases[0], id: 'case-c3', room: 'C3', roomId: 'C3', roomName: '三号复合手术间' },
    ];

    const groups = groupCasesByRoom(cases, ['A1', 'B2']);

    expect(groups.map((group) => group.roomId)).toEqual(['A1', 'B2', 'C3']);
    expect(groups.find((group) => group.roomId === 'C3')?.roomName).toBe('三号复合手术间');
    expect(groups.flatMap((group) => group.cases).map((item) => item.id)).toEqual([
      'case-a1',
      'case-b2',
      'case-c3',
    ]);
  });

  it('separates assigned and unassigned operation counts using OperationCase room truth', () => {
    const cases = [
      { ...anesthesiaCases[0], id: 'assigned-a1', room: 'A1', roomId: 'A1' },
      { ...anesthesiaCases[0], id: 'assigned-b2', room: '', roomId: 'B2' },
      { ...anesthesiaCases[0], id: 'unassigned', room: '', roomId: '', roomName: '' },
    ];

    expect(summarizeRoomAssignments(cases)).toEqual({ total: 3, assigned: 2, unassigned: 1 });
  });
});

describe('dedupeCasesByOperationId', () => {
  const mk = (id: string, over: Partial<SurgeryCase> = {}): SurgeryCase => ({ ...anesthesiaCases[0], id, ...over } as SurgeryCase);

  it('相同 operationId 只保留一项（多来源/轮询重复）', () => {
    const a = mk('OP-1001', { patientName: '宋纪东' });
    const aDup = mk('OP-1001', { patientName: '宋纪东', vitals: [{ id: 'v1', time: '08:00', HR: 80 } as never] });
    const out = dedupeCasesByOperationId([a, aDup, a]);
    expect(out.filter((c) => c.id === 'OP-1001')).toHaveLength(1);
  });

  it('同名不同 operationId 的两台手术都保留（不按姓名去重）', () => {
    const out = dedupeCasesByOperationId([
      mk('OP-1001', { patientName: '宋纪东', surgeryName: '手术甲' }),
      mk('OP-1002', { patientName: '宋纪东', surgeryName: '手术乙' }),
    ]);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((c) => c.id)).size).toBe(2);
  });

  it('operationId 为空的记录被过滤，不生成选项', () => {
    const out = dedupeCasesByOperationId([mk('OP-1001'), mk(''), mk('   ')]);
    expect(out).toHaveLength(1);
  });

  it('保留信息更完整的记录', () => {
    const sparse = mk('OP-1001', { surgeryName: '' });
    const full = mk('OP-1001', { surgeryName: '手术甲', recordStatus: '采集中' });
    const out = dedupeCasesByOperationId([sparse, full]);
    expect(out[0].surgeryName).toBe('手术甲');
  });
});

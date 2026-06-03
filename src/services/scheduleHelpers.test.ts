import { describe, expect, it } from 'vitest';
import { anesthesiaCases } from '@/mock/anesthesiaCases';
import { getDoctorCases, groupCasesByRoom, normalizeCaseSchedule } from '@/services/scheduleHelpers';

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
    });
    expect(normalized.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(normalized.endTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isNaN(Date.parse(normalized.startTime))).toBe(false);
    expect(Number.isNaN(Date.parse(normalized.endTime))).toBe(false);
  });

  it('groups operating rooms with stable room identities', () => {
    const groups = groupCasesByRoom(anesthesiaCases, ['OR-01', 'OR-02', 'OR-03']);

    expect(groups).toHaveLength(3);
    expect(groups[0].roomId).toBe('OR-01');
    expect(groups.every((item) => Array.isArray(item.cases))).toBe(true);
  });
});

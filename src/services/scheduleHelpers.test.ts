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

  it('groups operating rooms with stable room identities', () => {
    const groups = groupCasesByRoom(anesthesiaCases, ['OR-01', 'OR-02', 'OR-03']);

    expect(groups).toHaveLength(3);
    expect(groups[0].roomId).toBe('OR-01');
    expect(groups.every((item) => Array.isArray(item.cases))).toBe(true);
  });
});

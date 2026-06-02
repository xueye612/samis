import { describe, expect, it } from 'vitest';
import type { SurgeryCase } from '@/types/anesthesia';
import {
  buildRecordPagination,
  buildTimeAxisPages,
  clipSegmentToPage,
  isTimeOnPage,
  resolveRecordAxisStart,
  resolveRecordPageNoForTime,
} from '@/services/recordPaginationEngine';
import { clockToMinutes, roundAxisStartTime } from '@/services/anesthesiaRecordEngine';

const baseCase = (): SurgeryCase => ({
  id: 'case-1',
  room: 'OR-01',
  sequence: 1,
  patientName: '测试',
  gender: '男',
  age: 50,
  department: '普外',
  diagnosis: '胆囊结石',
  surgeryName: '腹腔镜胆囊切除',
  surgeon: '张医生',
  anesthesiaMethod: '全身麻醉',
  asa: 'II',
  urgency: '择期',
  anesthesiologist: '李医生',
  anesthesiaNurse: '王护士',
  status: '麻醉中',
  locationType: '手术室内',
  plannedStart: '2026-05-30T08:00:00',
  roomInTime: '2026-05-30T07:52:00',
  anesthesiaStart: '2026-05-30T08:05:00',
  expectedDurationMinutes: 300,
  locked: false,
  activeWarming: false,
  autologousBlood: false,
  postoperativeAnalgesia: true,
  preVisit: {
    completed: true,
    height: 170,
    weight: 70,
    asa: 'II',
    allergy: '无',
    anesthesiaHistory: '无',
    difficultAirway: '否',
    fasting: '8小时',
    preMedication: '无',
    specialCondition: '',
    plan: '全麻',
    doctorSignature: '李医生',
  },
  vitals: [],
  events: [],
  medications: [],
  fluids: [],
  outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
});

describe('recordPaginationEngine', () => {
  it('rounds axis start backward to 00 or 30 minutes', () => {
    expect(roundAxisStartTime('08:05')).toBe('08:00');
    expect(roundAxisStartTime('08:42')).toBe('08:30');
  });

  it('builds continuous pages for long cases', () => {
    const record = baseCase();
    record.surgeryEnd = '2026-05-30T16:10:00';
    const { pages, axisStart } = buildRecordPagination(record, { pageDurationMinutes: 210 });
    expect(axisStart).toBe('07:30');
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[1].pageStartTime).toBe(pages[0].pageEndTime);
  });

  it('clips cross-page segments', () => {
    const pages = buildTimeAxisPages('08:00', '12:00', { pageDurationMinutes: 120 });
    const clipped = clipSegmentToPage('09:30', '10:30', pages[0]);
    expect(clipped?.start).toBe('09:30');
    expect(clipped?.end).toBe('10:00');
    expect(clipped?.continuesToNext).toBe(true);
  });

  it('does not extend pagination past surgery end when vitals continue', () => {
    const record = baseCase();
    record.roomInTime = '2026-06-02T10:10:00';
    record.surgeryEnd = '2026-06-02T14:08:00';
    record.leaveRoomTime = '2026-06-02T14:20:00';
    record.vitals = [
      { id: 'v1', time: '2026-06-02T12:00:00', HR: 80, source: '设备采集' },
      { id: 'v2', time: '2026-06-02T18:10:00', HR: 78, source: '设备采集' },
    ];
    const { pages, axisEnd } = buildRecordPagination(record, { pageDurationMinutes: 210 });
    const endM = (clockToMinutes(axisEnd) ?? 0);
    const leaveM = clockToMinutes('14:20') ?? 0;
    expect(endM).toBeLessThanOrEqual(leaveM + 60);
    expect(pages.length).toBeLessThanOrEqual(2);
  });

  it('uses full page duration on the last page (paper-style window)', () => {
    const pages = buildTimeAxisPages('13:35', '18:05', { pageDurationMinutes: 210 });
    expect(pages.length).toBe(2);
    expect(pages[0].pageEndTime).toBe('17:05');
    expect(pages[1].pageStartTime).toBe('17:05');
    expect(pages[1].pageEndTime).toBe('20:35');
  });

  it('detects time on page with half-open boundaries', () => {
    const pages = buildTimeAxisPages('08:00', '11:30', { pageDurationMinutes: 180 });
    expect(pages[0].pageEndTime).toBe('11:00');
    expect(pages[1].pageStartTime).toBe('11:00');
    expect(isTimeOnPage('09:00', pages[0])).toBe(true);
    expect(isTimeOnPage('10:59', pages[0])).toBe(true);
    expect(isTimeOnPage('11:00', pages[0])).toBe(false);
    expect(isTimeOnPage('11:00', pages[1])).toBe(true);
    expect(isTimeOnPage('12:00', pages[0])).toBe(false);
  });

  it('includes axis end on the last page only', () => {
    const pages = buildTimeAxisPages('08:00', '11:30', { pageDurationMinutes: 120 });
    const last = pages[pages.length - 1];
    expect(isTimeOnPage('11:30', last)).toBe(true);
    if (pages.length > 1) {
      expect(isTimeOnPage('11:30', pages[0])).toBe(false);
    }
  });

  it('uses rounded room-in time for axis start after entry', () => {
    expect(resolveRecordAxisStart(baseCase())).toBe('07:30');
  });

  it('uses scheduled start before room-in and rounds backward', () => {
    const record = baseCase();
    record.roomInTime = undefined;
    record.scheduledStart = '2026-05-30T08:17:00';
    record.plannedStart = '2026-05-30T07:00:00';
    expect(resolveRecordAxisStart(record)).toBe('08:00');
  });

  it('prefers scheduledStart over plannedStart before room-in', () => {
    const record = baseCase();
    record.roomInTime = undefined;
    record.scheduledStart = '2026-05-30T09:42:00';
    record.plannedStart = '2026-05-30T08:00:00';
    expect(resolveRecordAxisStart(record)).toBe('09:30');
  });

  it('does not use anesthesiaStart when room-in is absent', () => {
    const record = baseCase();
    record.roomInTime = undefined;
    record.anesthesiaStart = '2026-05-30T08:05:00';
    record.plannedStart = '2026-05-30T08:20:00';
    expect(resolveRecordAxisStart(record)).toBe('08:00');
  });

  it('resolves page number for a clock time inside the case', () => {
    const record = baseCase();
    record.surgeryEnd = '2026-05-30T16:10:00';
    const pageNo = resolveRecordPageNoForTime(record, '2026-05-30T12:30:00', { pageDurationMinutes: 210 });
    expect(pageNo).toBeGreaterThanOrEqual(1);
    const { pages } = buildRecordPagination(record, { pageDurationMinutes: 210 });
    expect(isTimeOnPage('12:30', pages[pageNo - 1])).toBe(true);
  });
});

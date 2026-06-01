import { describe, expect, it } from 'vitest';
import type { SurgeryCase } from '@/types/anesthesia';
import {
  buildRecordPagination,
  buildTimeAxisPages,
  clipSegmentToPage,
  isTimeOnPage,
  resolveRecordAxisStart,
} from '@/services/recordPaginationEngine';
import { roundAxisStartTime } from '@/services/anesthesiaRecordEngine';

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
    expect(axisStart).toBe('07:52');
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

  it('detects time on page', () => {
    const pages = buildTimeAxisPages('08:00', '11:30');
    expect(isTimeOnPage('09:00', pages[0])).toBe(true);
    expect(isTimeOnPage('12:00', pages[0])).toBe(false);
  });

  it('uses the exact room in time for axis start', () => {
    expect(resolveRecordAxisStart(baseCase())).toBe('07:52');
  });
});

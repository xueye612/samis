import { describe, expect, it } from 'vitest';
import {
  buildTimelineNodeStates,
  clearTimelineNodeTime,
  getMethodTimelineNodes,
  resolveTimelineNodeSource,
  resolveTimelineNodeTime,
  validateTimelineNodeTime,
  applyTimelineNodeTime,
} from '@/services/methodTimelineEngine';
import { anesthesiaCases } from '@/mock/anesthesiaCases';
import type { SurgeryCase } from '@/types/anesthesia';

const baseRecord = (): SurgeryCase => ({
  ...(anesthesiaCases[0] as SurgeryCase),
  roomInTime: undefined,
  anesthesiaStart: undefined,
  surgeryStart: undefined,
  surgeryEnd: undefined,
  anesthesiaEnd: undefined,
  leaveRoomTime: undefined,
  events: [],
  originalRoomInTime: undefined,
  originalLeaveRoomTime: undefined,
});

describe('关键时间原因规则与顺序覆盖', () => {
  it('首次录入：顺序正常时 valid，不强制原因', () => {
    const record = baseRecord();
    const node = getMethodTimelineNodes(['general']).find((n) => n.key === 'room-in')!;
    const r = validateTimelineNodeTime(record, ['general'], node, '2026-07-16T08:00:00+08:00');
    expect(r.valid).toBe(true);
    expect(r.severity).toBe('ok');
  });

  it('修改已有时间：原时间存在即为修改场景（需原因，由视图层强制）', () => {
    const record = baseRecord();
    const node = getMethodTimelineNodes(['general']).find((n) => n.key === 'room-in')!;
    applyTimelineNodeTime(record, node, '2026-07-16T08:00:00+08:00');
    expect(resolveTimelineNodeTime(record, node)).toBe('2026-07-16T08:00:00+08:00');
    const states = buildTimelineNodeStates(record, ['general']);
    const state = states.find((s) => s.key === 'room-in')!;
    expect(state.recorded).toBe(true);
  });

  it('正常顺序直接允许保存（valid + ok）', () => {
    const record = baseRecord();
    record.roomInTime = '2026-07-16T08:00:00+08:00';
    record.anesthesiaStart = '2026-07-16T08:10:00+08:00';
    const node = getMethodTimelineNodes(['general']).find((n) => n.key === 'surgery-start')!;
    const r = validateTimelineNodeTime(record, ['general'], node, '2026-07-16T08:40:00+08:00');
    expect(r.valid).toBe(true);
    expect(r.severity).toBe('ok');
  });

  it('异常顺序出现警告 + orderConflict（可覆盖）', () => {
    const record = baseRecord();
    record.roomInTime = '2026-07-16T08:00:00+08:00';
    record.anesthesiaStart = '2026-07-16T08:10:00+08:00';
    record.surgeryStart = '2026-07-16T08:40:00+08:00';
    record.surgeryEnd = '2026-07-16T10:00:00+08:00';
    const node = getMethodTimelineNodes(['general']).find((n) => n.key === 'surgery-start')!;
    const r = validateTimelineNodeTime(record, ['general'], node, '2026-07-16T08:05:00+08:00');
    expect(r.valid).toBe(false);
    expect(r.severity).toBe('warning');
    expect(r.orderConflict).toBe(true);
    expect(r.message).toContain('请确认时间');
    expect(r.conflicts?.[0]?.label).toBe('麻醉开始');
  });

  it('无效时间为 error 且不可覆盖', () => {
    const record = baseRecord();
    const node = getMethodTimelineNodes(['general']).find((n) => n.key === 'room-in')!;
    const r = validateTimelineNodeTime(record, ['general'], node, 'bad-time');
    expect(r.valid).toBe(false);
    expect(r.severity).toBe('error');
    expect(r.orderConflict).toBeUndefined();
  });
});

describe('关键时间清除', () => {
  it('clearTimelineNodeTime 置空字段并移除事件，不物理删除审计', () => {
    const record = baseRecord();
    const node = getMethodTimelineNodes(['general']).find((n) => n.key === 'surgery-start')!;
    applyTimelineNodeTime(record, node, '2026-07-16T08:40:00+08:00');
    expect(record.surgeryStart).toBe('2026-07-16T08:40:00+08:00');
    clearTimelineNodeTime(record, node);
    expect(record.surgeryStart).toBeUndefined();
    expect(resolveTimelineNodeTime(record, node)).toBeUndefined();
  });
});

describe('HULI 原始时间保护', () => {
  it('入室节点来源标注为 HULI 扫描；修正后标注为 HULI 原始(已修正)，原始值不被覆盖', () => {
    const record = baseRecord();
    record.roomInTime = '2026-07-16T08:00:00+08:00';
    const node = getMethodTimelineNodes(['general']).find((n) => n.key === 'room-in')!;
    expect(resolveTimelineNodeSource(record, node)).toBe('HULI扫描');
    // 模拟 SAMIS 修正：保存原始到 originalRoomInTime，覆盖 roomInTime
    record.originalRoomInTime = record.roomInTime;
    record.roomInTime = '2026-07-16T08:03:00+08:00';
    expect(resolveTimelineNodeSource(record, node)).toBe('HULI原始(已修正)');
    expect(record.originalRoomInTime).toBe('2026-07-16T08:00:00+08:00');
    expect(record.roomInTime).toBe('2026-07-16T08:03:00+08:00');
  });

  it('麻醉开始等 SAMIS 维护节点来源为人工录入', () => {
    const record = baseRecord();
    record.anesthesiaStart = '2026-07-16T08:10:00+08:00';
    const node = getMethodTimelineNodes(['general']).find((n) => n.key === 'anes-start')!;
    expect(resolveTimelineNodeSource(record, node)).toBe('人工录入');
  });
});

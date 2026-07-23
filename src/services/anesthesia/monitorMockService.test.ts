import { describe, expect, it } from 'vitest';
import {
  buildStableVitalId,
  clampMonitorDisplayIntervalMinutes,
  DEFAULT_MONITOR_DISPLAY_INTERVAL_MINUTES,
  RESCUE_MONITOR_DISPLAY_INTERVAL_MINUTES,
  resolveMonitorDisplayIntervalMinutes,
  resolveVitalBucketKey,
  resolveVitalSlotTime,
} from './monitorMockService';
import { isRescueModeActive } from '@/services/anesthesiaRecordEngine';
import type { SurgeryCase } from '@/types/anesthesia';

describe('monitorMockService interval', () => {
  it('defaults to 5 minutes and clamps to 1-5', () => {
    expect(DEFAULT_MONITOR_DISPLAY_INTERVAL_MINUTES).toBe(5);
    expect(RESCUE_MONITOR_DISPLAY_INTERVAL_MINUTES).toBe(1);
    expect(clampMonitorDisplayIntervalMinutes(undefined)).toBe(5);
    expect(clampMonitorDisplayIntervalMinutes(0)).toBe(1);
    expect(clampMonitorDisplayIntervalMinutes(3.6)).toBe(4);
    expect(clampMonitorDisplayIntervalMinutes(9)).toBe(5);
  });

  it('uses 1 minute in rescue mode regardless of configured interval', () => {
    expect(resolveMonitorDisplayIntervalMinutes({ rescueMode: true, displayIntervalMinutes: 5 })).toBe(1);
    expect(resolveMonitorDisplayIntervalMinutes({ simulationMode: 'rescue', displayIntervalMinutes: 5 })).toBe(1);
    expect(resolveMonitorDisplayIntervalMinutes({ rescueMode: false, displayIntervalMinutes: 3 })).toBe(3);
  });
});

describe('每 tick 按当前抢救态解析采集间隔（清除抢救后立即恢复 5 分钟）', () => {
  const mk = (rescue: Partial<NonNullable<SurgeryCase['rescue']>> | undefined): SurgeryCase =>
    ({ id: 'c1', rescue: rescue as SurgeryCase['rescue'] } as SurgeryCase);

  it('抢救有效（有 startTime 无 endTime）→ 1 分钟', () => {
    const active = mk({ startTime: '2026-07-22T10:00:00.000Z', endTime: undefined });
    expect(isRescueModeActive(active)).toBe(true);
    expect(resolveMonitorDisplayIntervalMinutes({ rescueMode: isRescueModeActive(active) })).toBe(1);
  });

  it('退出抢救（有 startTime 且有 endTime）→ 恢复 5 分钟', () => {
    const ended = mk({ startTime: '2026-07-22T10:00:00.000Z', endTime: '2026-07-22T10:05:00.000Z' });
    expect(isRescueModeActive(ended)).toBe(false);
    expect(resolveMonitorDisplayIntervalMinutes({ rescueMode: isRescueModeActive(ended) })).toBe(5);
  });

  it('无抢救态 → 5 分钟', () => {
    const none = mk(undefined);
    expect(isRescueModeActive(none)).toBe(false);
    expect(resolveMonitorDisplayIntervalMinutes({ rescueMode: isRescueModeActive(none) })).toBe(5);
  });
});

describe('代表点时间槽归一与稳定 ID（monitor/ventilator 共用）', () => {
  it('将采集时间归一至整 5 分钟刻度、秒归零', () => {
    expect(resolveVitalSlotTime('2026-07-22T10:07:32', 5)).toBe('2026-07-22T10:05:00');
    expect(resolveVitalSlotTime('2026-07-22T10:09:59', 5)).toBe('2026-07-22T10:05:00');
    expect(resolveVitalSlotTime('2026-07-22T10:10:00', 5)).toBe('2026-07-22T10:10:00');
    expect(resolveVitalSlotTime('2026-07-22T10:00:00', 5)).toBe('2026-07-22T10:00:00');
  });

  it('抢救模式按 1 分钟归一', () => {
    expect(resolveVitalSlotTime('2026-07-22T10:07:32', 1)).toBe('2026-07-22T10:07:00');
  });

  it('分桶键随槽位递增，整刻度对齐', () => {
    expect(resolveVitalBucketKey('2026-07-22T10:07:32', 5)).toBe(resolveVitalBucketKey('2026-07-22T10:09:59', 5));
    expect(resolveVitalBucketKey('2026-07-22T10:09:59', 5)).not.toBe(resolveVitalBucketKey('2026-07-22T10:10:00', 5));
  });

  it('同槽稳定 ID 不变，新槽产生新 ID，含记录与类型标识', () => {
    const a = buildStableVitalId('case-or01', '2026-07-22T10:05:00', 'monitor');
    const a2 = buildStableVitalId('case-or01', '2026-07-22T10:05:00', 'monitor');
    const b = buildStableVitalId('case-or01', '2026-07-22T10:10:00', 'monitor');
    const v = buildStableVitalId('case-or01', '2026-07-22T10:05:00', 'ventilator');
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
    expect(a).toContain('case-or01');
    expect(a).toContain('monitor');
    expect(a).not.toBe(v);
  });
});


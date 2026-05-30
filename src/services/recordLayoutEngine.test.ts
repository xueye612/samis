import { describe, expect, it } from 'vitest';
import { buildMonitorLayoutObjects, resolveLayoutCollisions } from '@/services/recordLayoutEngine';
import type { MonitorCell } from '@/services/anesthesiaRecordEngine';

describe('recordLayoutEngine', () => {
  it('offsets overlapping monitor cells vertically', () => {
    const cells: MonitorCell[] = [
      {
        key: 'a',
        row: { time: '09:00', HR: 80 },
        metric: 'HR',
        value: 80,
        time: '09:00',
        rowIndex: 0,
        rowCount: 2,
        leftPercent: 50,
        topPercent: 20,
        abnormal: false,
        unit: 'bpm',
      },
      {
        key: 'b',
        row: { time: '09:00', SpO2: 99 },
        metric: 'SpO2',
        value: 99,
        time: '09:00',
        rowIndex: 1,
        rowCount: 2,
        leftPercent: 50,
        topPercent: 20,
        abnormal: false,
        unit: '%',
      },
    ];
    const objects = buildMonitorLayoutObjects(cells);
    const { objects: placed } = resolveLayoutCollisions(objects);
    expect(placed.length).toBe(2);
    expect(placed[0].y).not.toBe(placed[1].y);
  });
});

import { describe, expect, it } from 'vitest';
import { buildMonitorLayoutObjects, resolveLayoutCollisions, resolveTimelineNodeLanes } from '@/services/recordLayoutEngine';
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
      abnormalDirection: '',
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
      abnormalDirection: '',
        unit: '%',
      },
    ];
    const objects = buildMonitorLayoutObjects(cells);
    const { objects: placed } = resolveLayoutCollisions(objects);
    expect(placed.length).toBe(2);
    expect(placed[0].y).not.toBe(placed[1].y);
  });

  it('assigns stagger lanes to overlapping timeline nodes', () => {
    const placed = resolveTimelineNodeLanes([
      { id: 'a', leftPercent: 20 },
      { id: 'b', leftPercent: 22 },
      { id: 'c', leftPercent: 50 },
    ]);
    expect(placed.find((item) => item.id === 'a')?.lane).toBe(0);
    expect(placed.find((item) => item.id === 'b')?.lane).toBe(1);
    expect(placed.find((item) => item.id === 'c')?.lane).toBe(0);
  });

  it('nudges display position when timeline nodes are too close horizontally', () => {
    const placed = resolveTimelineNodeLanes([
      { id: 'a', leftPercent: 4.2 },
      { id: 'b', leftPercent: 5.6 },
    ]);
    const a = placed.find((item) => item.id === 'a');
    const b = placed.find((item) => item.id === 'b');
    expect(a?.displayPercent).toBe(4.2);
    expect(b?.lane).toBeGreaterThan(0);
    expect(Math.abs((b?.displayPercent ?? 0) - (a?.displayPercent ?? 0))).toBeGreaterThan(1.5);
  });
});

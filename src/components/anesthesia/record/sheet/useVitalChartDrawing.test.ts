import { describe, expect, it } from 'vitest';
import type { VitalSign } from '@/types/anesthesia';
import type { VitalSignDictItem } from '@/types/system';
import { useVitalChartDrawing, vitalSymbolText } from './useVitalChartDrawing';

const hr: VitalSignDictItem = {
  shortCode: 'HR',
  name: '心率',
  unit: 'bpm',
  enabled: true,
  chartEnabled: true,
  chartColor: '#ef4444',
  chartSymbol: 'circle',
} as VitalSignDictItem;

// sheetStart / sheetEnd are clock strings (HH:mm) in the live sheet.
const vitals: VitalSign[] = [
  { time: '08:00', HR: 80 },
  { time: '09:00', HR: 90 },
  { time: '10:00' },
];

describe('useVitalChartDrawing', () => {
  const draw = useVitalChartDrawing(() => vitals, () => '08:00', () => '10:00');

  it('maps only numeric points and clamps x into [0,1000]', () => {
    const points = draw.chartPoints(hr);
    expect(points).toHaveLength(2);
    expect(points[0].x).toBe(0);
    expect(points[1].x).toBe(500);
    points.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1000);
    });
  });

  it('builds a polyline points string from the numeric samples', () => {
    const line = draw.chartLine(hr);
    expect(line.split(' ')).toHaveLength(2);
    expect(line).toMatch(/^\d/);
  });

  it('resolves marker symbols and fills', () => {
    expect(vitalSymbolText('triangle-down')).toBe('▽');
    expect(vitalSymbolText(undefined)).toBe('•');
    expect(typeof draw.markerPath(hr, 10, 20)).toBe('string');
    expect(draw.markerFill(hr)).toBeTruthy();
  });
});

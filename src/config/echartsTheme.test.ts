import { describe, expect, it } from 'vitest';
import { anesthesiaChartPalette, buildAxisStyle, buildGrid, qualityChartPalette } from '@/config/echartsTheme';

describe('echartsTheme', () => {
  it('provides stable commercial chart palettes', () => {
    expect(qualityChartPalette.primary).toBe('#2563eb');
    expect(qualityChartPalette.positive).toBe('#16a34a');
    expect(anesthesiaChartPalette.temperatureSafe).toBe('#0d9488');
    expect(anesthesiaChartPalette.temperatureRisk).toBe('#dc2626');
  });

  it('builds shared axis and grid style for charts', () => {
    const axis = buildAxisStyle();
    const grid = buildGrid({ top: 40 });

    expect(axis.axisLabel.color).toBe('#64748b');
    expect(axis.splitLine.lineStyle.color).toBe('#e2e8f0');
    expect(grid.left).toBe(48);
    expect(grid.top).toBe(40);
  });
});

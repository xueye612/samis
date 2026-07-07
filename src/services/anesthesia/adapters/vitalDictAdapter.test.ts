import { describe, expect, it } from 'vitest';
import { mapVitalDictItem, mapVitalDictListResponse } from '@/services/anesthesia/adapters/vitalDictAdapter';

describe('vitalDictAdapter', () => {
  it('maps camelCase vital rows with chart settings', () => {
    const item = mapVitalDictItem({
      id: 1, code: 'V-HR', shortCode: 'HR', itemName: '心率 HR', unit: 'bpm',
      normalRange: '50-120', lowerLimit: 50, upperLimit: 120,
      chartEnabled: true, chartColor: '#16a34a', chartSymbol: 'circle', decimalPlaces: 0, sortOrder: 1,
    });
    expect(item!.shortCode).toBe('HR');
    expect(item!.chartColor).toBe('#16a34a');
    expect(item!.enabled).toBe(true);
  });

  it('sorts by sortOrder ascending', () => {
    const items = mapVitalDictListResponse({
      list: [
        { id: 2, itemName: 'SBP', sort_no: 2 },
        { id: 1, itemName: 'HR', sort_no: 1 },
      ],
    });
    expect(items[0].name).toBe('HR');
    expect(items[1].name).toBe('SBP');
  });
});

import { describe, expect, it } from 'vitest';
import { anesthesiaCases } from '@/mock/anesthesiaCases';
import { useRecordCoordinates } from './useRecordCoordinates';

describe('useRecordCoordinates', () => {
  const record = anesthesiaCases[0];

  it('derives a time scale and page from the record', () => {
    const coords = useRecordCoordinates(() => record, () => 1);
    expect(coords.timeScale.value.majorTicks.length).toBeGreaterThan(0);
    expect(coords.currentPage.value).toBeTruthy();
    expect(typeof coords.sheetStart.value).toBe('string');
    expect(typeof coords.sheetEnd.value).toBe('string');
  });

  it('maps the axis start to the left edge and produces grid rows', () => {
    const coords = useRecordCoordinates(() => record, () => 1);
    expect(coords.leftFor(coords.sheetStart.value)).toBe('0%');
    expect(coords.bandGrid(3).rowLines.length).toBeGreaterThan(0);
    expect(coords.chartGrid.value.verticalLines.length).toBeGreaterThan(0);
  });

  it('positions a row by index and hides segments without a start time', () => {
    const coords = useRecordCoordinates(() => record, () => 1);
    expect(coords.topFor(0, 2)).toBe('25%');
    expect(coords.segmentStyle(undefined, undefined, 0, 3)).toEqual({ display: 'none' });
    const style = coords.pointStyle(coords.sheetStart.value, 0, 2);
    expect(style.left).toBe('0%');
    expect(style.top).toBe('25%');
  });
});

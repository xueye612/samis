import { describe, expect, it } from 'vitest';
import { anesthesiaCases } from '@/mock/anesthesiaCases';
import { buildRecordPagination } from '@/services/recordPaginationEngine';
import { ensureRecordDocument } from '@/services/anesthesiaRecordEngine';
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

  it('follows refreshed timeAxisPages after room-in changes', () => {
    const staleStart = '13:23';
    const updated = {
      ...record,
      roomInTime: `${record.plannedStart?.slice(0, 10) ?? '2026-06-02'}T10:26:00`,
      recordDocument: {
        ...ensureRecordDocument(record),
        timeAxisPages: [{
          pageNo: 1,
          pageCount: 1,
          pageStartTime: staleStart,
          pageEndTime: '16:53',
          majorGridMinutes: 30,
          minorGridMinutes: 5,
          pageDurationMinutes: 210,
        }],
      },
    };
    const beforeSync = useRecordCoordinates(() => updated, () => 1);
    expect(beforeSync.sheetStart.value).toBe(staleStart);

    const { pages } = buildRecordPagination(updated);
    updated.recordDocument = { ...updated.recordDocument!, timeAxisPages: pages };
    const afterSync = useRecordCoordinates(() => updated, () => 1);
    expect(afterSync.sheetStart.value).toBe('10:26');
  });
});

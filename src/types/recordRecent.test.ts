import { describe, expect, it } from 'vitest';
import type { RecordRecentEntry } from '@/types/recordRecent';

const trimRecentEntries = (entries: RecordRecentEntry[], next: Omit<RecordRecentEntry, 'id'>) => [
  { id: 'new', ...next },
  ...entries,
].slice(0, 8);

describe('record recent entries queue', () => {
  it('keeps at most eight entries with newest first', () => {
    const seed = Array.from({ length: 8 }, (_, index) => ({
      id: `entry-${index}`,
      kind: 'event' as const,
      label: `事件${index}`,
      time: `2026-05-26T08:${String(index).padStart(2, '0')}:00.000Z`,
      target: 'sheet-event' as const,
    }));
    const next = trimRecentEntries(seed, {
      kind: 'medication',
      label: '丙泊酚 100mg',
      time: '2026-05-26T08:30:00.000Z',
      target: 'medication',
    });
    expect(next).toHaveLength(8);
    expect(next[0]?.label).toBe('丙泊酚 100mg');
    expect(next[1]?.label).toBe('事件0');
    expect(next.some((item) => item.label === '事件7')).toBe(false);
  });
});

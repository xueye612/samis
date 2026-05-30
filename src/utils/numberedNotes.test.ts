import { describe, expect, it } from 'vitest';
import {
  buildSequenceMarkersFromNotes,
  normalizeNumberedNotes,
  parseClockFromNoteContent,
  parseNumberedNoteLines,
  stripClockFromNoteContent,
} from '@/utils/numberedNotes';

describe('numberedNotes', () => {
  it('parses numbered lines', () => {
    expect(parseNumberedNoteLines('1. 依托咪酯 16mg\n2. 舒芬太尼 20ug')).toEqual([
      expect.objectContaining({ index: 1, content: '依托咪酯 16mg', displayContent: '依托咪酯 16mg' }),
      expect.objectContaining({ index: 2, content: '舒芬太尼 20ug', displayContent: '舒芬太尼 20ug' }),
    ]);
  });

  it('normalizes plain lines to numbered format', () => {
    expect(normalizeNumberedNotes('依托咪酯 16mg\n舒芬太尼 20ug')).toBe('1. 依托咪酯 16mg\n2. 舒芬太尼 20ug');
  });

  it('extracts clock time from note content', () => {
    expect(parseClockFromNoteContent('09:15 去甲肾上腺素 4ug')).toBe('09:15');
    expect(parseClockFromNoteContent('去甲肾上腺素 4ug')).toBeUndefined();
    expect(stripClockFromNoteContent('09:15 昂丹司琼 8mg')).toBe('昂丹司琼 8mg');
  });

  it('builds sequence markers only for timed numbered lines', () => {
    const lines = parseNumberedNoteLines([
      '1. 09:15 盐酸昂丹司琼 8mg',
      '2. 地塞米松 10mg',
      '3. 10:30 纳布啡 10mg',
    ].join('\n'));
    const markers = buildSequenceMarkersFromNotes(lines, {
      rowIndex: 3,
      tone: 'orange',
      idPrefix: 'special',
      noteKey: 'specialMeds',
      clockToIso: (clock) => `2026-05-30T${clock}:00.000Z`,
    });
    expect(markers).toHaveLength(2);
    expect(markers.map((item) => item.number)).toEqual([1, 3]);
    expect(markers[0].content).toBe('盐酸昂丹司琼 8mg');
    expect(markers[1].content).toBe('纳布啡 10mg');
  });
});

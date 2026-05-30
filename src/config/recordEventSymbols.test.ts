import { describe, expect, it } from 'vitest';
import {
  buildEventLegendPairs,
  buildRoomLegendItems,
  DEFAULT_RECORD_EVENT_SYMBOLS,
  FALLBACK_EVENT_SYMBOL,
  resolveEventSymbol,
} from './recordEventSymbols';

describe('recordEventSymbols', () => {
  it('resolves symbols by keyword containment', () => {
    expect(resolveEventSymbol('麻醉开始')).toBe('X');
    expect(resolveEventSymbol('麻醉结束')).toBe('*');
    expect(resolveEventSymbol('手术开始')).toBe('◎');
    expect(resolveEventSymbol('气管插管')).toBe('Φ');
    expect(resolveEventSymbol('拔管完成')).toBe('Θ');
    expect(resolveEventSymbol('入手术室')).toBe('▷');
    expect(resolveEventSymbol('离室')).toBe('▶');
  });

  it('returns fallback symbol for unknown or empty events', () => {
    expect(resolveEventSymbol('不存在的事件')).toBe(FALLBACK_EVENT_SYMBOL);
    expect(resolveEventSymbol('')).toBe(FALLBACK_EVENT_SYMBOL);
  });

  it('supports custom registries for future backend dictionaries', () => {
    const custom = [{ key: 'custom', label: '自定义', symbol: '★', keywords: ['特护'] }];
    expect(resolveEventSymbol('特护转入', custom)).toBe('★');
    expect(resolveEventSymbol('麻醉开始', custom)).toBe(FALLBACK_EVENT_SYMBOL);
  });

  it('groups paired legend items two per row', () => {
    const pairs = buildEventLegendPairs();
    expect(pairs.length).toBeGreaterThan(0);
    pairs.forEach((row) => expect(row.length).toBeLessThanOrEqual(2));
    const flattened = pairs.flat().map((item) => item.label);
    expect(flattened).toContain('麻醉开始');
    expect(flattened).toContain('麻醉拔管');
  });

  it('builds room legend from registry, keeping entry before exit', () => {
    const room = buildRoomLegendItems();
    expect(room.map((item) => item.label)).toEqual(['入手术室', '出手术室']);
  });

  it('keeps default registry keys unique', () => {
    const keys = DEFAULT_RECORD_EVENT_SYMBOLS.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

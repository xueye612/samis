import { describe, expect, it } from 'vitest';
import {
  buildEventLegendPairs,
  buildRoomLegendItems,
  DEFAULT_RECORD_EVENT_SYMBOLS,
  FALLBACK_EVENT_SYMBOL,
  resolveEventSymbol,
  resolveEventSymbolDef,
  CLINICAL_SYMBOL_SHAPES,
} from './recordEventSymbols';

describe('recordEventSymbols 权威映射', () => {
  it('按关键字解析出权威符号字形', () => {
    expect(resolveEventSymbol('麻醉开始')).toBe('*');
    expect(resolveEventSymbol('麻醉结束')).toBe('◎');
    expect(resolveEventSymbol('手术开始')).toBe('Ⓞ');
    expect(resolveEventSymbol('手术结束')).toBe('Φ');
    expect(resolveEventSymbol('气管插管')).toBe('Θ');
    expect(resolveEventSymbol('拔管完成')).toBe('▷');
    expect(resolveEventSymbol('入手术室')).toBe('▶');
    expect(resolveEventSymbol('离室')).toBe('●');
  });

  it('不再保留旧实现的错误映射', () => {
    // 旧实现把麻醉开始误记为 X、入室误记为 ▷、出室误记为 ▶，必须被纠正。
    expect(resolveEventSymbol('麻醉开始')).not.toBe('X');
    expect(resolveEventSymbol('入手术室')).not.toBe('▷');
    expect(resolveEventSymbol('出手术室')).not.toBe('▶');
  });

  it('未知或空事件回退占位符号', () => {
    expect(resolveEventSymbol('不存在的事件')).toBe(FALLBACK_EVENT_SYMBOL);
    expect(resolveEventSymbol('')).toBe(FALLBACK_EVENT_SYMBOL);
  });

  it('支持自定义注册表以对接后端字典', () => {
    const custom: import('./recordEventSymbols').RecordEventSymbolDef[] = [{ key: 'custom', label: '自定义', symbol: '★', shape: 'star', keywords: ['特护'] }];
    expect(resolveEventSymbol('特护转入', custom)).toBe('★');
    expect(resolveEventSymbol('麻醉开始', custom)).toBe(FALLBACK_EVENT_SYMBOL);
  });

  it('每个事件符号都携带确定性的矢量形状，不再仅依赖 Unicode 字形', () => {
    for (const def of DEFAULT_RECORD_EVENT_SYMBOLS) {
      expect(def.shape, `${def.key} 缺少矢量形状`).toBeTruthy();
      expect(CLINICAL_SYMBOL_SHAPES, `${def.key} 形状 ${def.shape} 未登记`).toHaveProperty(def.shape);
    }
  });

  it('图例与注册表共用同一形状来源，避免组件内重复硬编码', () => {
    const pairs = buildEventLegendPairs();
    expect(pairs.length).toBeGreaterThan(0);
    pairs.forEach((row) => expect(row.length).toBeLessThanOrEqual(2));
    const byLabel = (label: string) => DEFAULT_RECORD_EVENT_SYMBOLS.find((item) => item.label === label);
    const legendAnesthesiaStart = pairs.flat().find((item) => item.label === '麻醉开始');
    const defAnesthesiaStart = byLabel('麻醉开始');
    expect(legendAnesthesiaStart?.shape).toBe(defAnesthesiaStart?.shape);
    expect(legendAnesthesiaStart?.letter).toBe(defAnesthesiaStart?.letter);

    const legendExtubation = pairs.flat().find((item) => item.label === '麻醉拔管');
    const defExtubation = byLabel('麻醉拔管');
    expect(legendExtubation?.shape).toBe(defExtubation?.shape);
  });

  it('成对图例每行至多两项', () => {
    const pairs = buildEventLegendPairs();
    pairs.forEach((row) => expect(row.length).toBeLessThanOrEqual(2));
    const flattened = pairs.flat().map((item) => item.label);
    expect(flattened).toContain('麻醉开始');
    expect(flattened).toContain('麻醉拔管');
  });

  it('出入室图例保持入室在前、出室在后', () => {
    const room = buildRoomLegendItems();
    expect(room.map((item) => item.label)).toEqual(['入手术室', '出手术室']);
    expect(room[0].shape).toBe(DEFAULT_RECORD_EVENT_SYMBOLS.find((item) => item.key === 'room-in')?.shape);
    expect(room[1].shape).toBe(DEFAULT_RECORD_EVENT_SYMBOLS.find((item) => item.key === 'room-out')?.shape);
  });

  it('resolveEventSymbolDef 返回完整定义，供图例与时间轴共用', () => {
    const def = resolveEventSymbolDef('气管插管');
    expect(def?.key).toBe('intubation');
    expect(def?.symbol).toBe('Θ');
    expect(def?.shape).toBeTruthy();
    expect(resolveEventSymbolDef('不存在')).toBeUndefined();
  });

  it('默认注册表 key 唯一', () => {
    const keys = DEFAULT_RECORD_EVENT_SYMBOLS.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('成对事件符号在黑白打印下两两可区分', () => {
    const pairShapes = buildEventLegendPairs()
      .flat()
      .map((item) => item.shape);
    // 每一组成对事件（如麻醉开始/结束、手术开始/结束、插管/拔管）形状不得相同。
    for (let i = 0; i < pairShapes.length; i += 2) {
      expect(pairShapes[i]).not.toBe(pairShapes[i + 1]);
    }
  });
});

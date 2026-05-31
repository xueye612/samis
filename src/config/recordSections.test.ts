import { describe, expect, it } from 'vitest';
import { OPTIONAL_RECORD_SECTIONS, resolveSectionVisible } from './recordSections';

describe('recordSections', () => {
  it('forces visible when mode is show, regardless of data', () => {
    expect(resolveSectionVisible('show', false)).toBe(true);
    expect(resolveSectionVisible('show', true)).toBe(true);
  });

  it('forces hidden when mode is hide, regardless of data', () => {
    expect(resolveSectionVisible('hide', true)).toBe(false);
    expect(resolveSectionVisible('hide', false)).toBe(false);
  });

  it('falls back to data presence for auto / undefined', () => {
    expect(resolveSectionVisible('auto', true)).toBe(true);
    expect(resolveSectionVisible('auto', false)).toBe(false);
    expect(resolveSectionVisible(undefined, true)).toBe(true);
    expect(resolveSectionVisible(undefined, false)).toBe(false);
  });

  it('exposes the optional sections with unique keys', () => {
    const keys = OPTIONAL_RECORD_SECTIONS.map((item) => item.key);
    expect(keys).toContain('inhaled');
    expect(keys).toContain('autologous');
    expect(new Set(keys).size).toBe(keys.length);
  });
});

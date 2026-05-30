import { describe, expect, it } from 'vitest';
import { matchesPinyinSearch } from '@/utils/pinyinSearch';

describe('matchesPinyinSearch', () => {
  it('matches Chinese substring', () => {
    expect(matchesPinyinSearch('全髋关节置换术', '髋关节')).toBe(true);
  });

  it('matches pinyin initials', () => {
    expect(matchesPinyinSearch('全髋关节置换术', 'qkgj')).toBe(true);
  });

  it('returns true for empty query', () => {
    expect(matchesPinyinSearch('任意文本', '')).toBe(true);
  });
});

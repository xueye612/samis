import { describe, expect, it } from 'vitest';
import { normalizeSingleHandoverPerson, splitHandoverPersonnel } from './handoverPersonnel';

describe('handoverPersonnel', () => {
  it('将组合人员字段拆成去重的单人选项', () => {
    expect(splitHandoverPersonnel(['张三、李四', '李四 / 王五', '赵六，钱七'])).toEqual([
      '张三',
      '李四',
      '王五',
      '赵六',
      '钱七',
    ]);
  });

  it('历史组合值只投影一个接班人', () => {
    expect(normalizeSingleHandoverPerson('张三、李四')).toBe('张三');
    expect(normalizeSingleHandoverPerson('')).toBe('');
  });
});

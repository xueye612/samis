import { describe, expect, it } from 'vitest';
import {
  formatNumberedSurgeryNames,
  formatSurgeryNameDisplay,
  formatSurgeryNamePlain,
  parseSurgeryNameValue,
} from '@/config/recordHeaderOptions';

describe('surgery name numbering', () => {
  it('formats selected names with order numbers', () => {
    expect(formatNumberedSurgeryNames(['全髋关节置换术', '病灶清除术'])).toBe('1.全髋关节置换术+2.病灶清除术');
  });

  it('stores and displays plain plus-joined names without ordinals', () => {
    expect(formatSurgeryNamePlain(['全髋关节置换术', '病灶清除术'])).toBe('全髋关节置换术+病灶清除术');
    expect(formatSurgeryNameDisplay('1.全髋关节置换术+2.病灶清除术')).toBe('全髋关节置换术+病灶清除术');
  });

  it('parses numbered stored value back to plain names', () => {
    expect(parseSurgeryNameValue('1.全髋关节置换术+2.病灶清除术')).toEqual(['全髋关节置换术', '病灶清除术']);
  });
});

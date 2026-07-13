import { describe, expect, it } from 'vitest';
import {
  isSamisAuthBusinessCode,
  readSamisResponseMessage,
} from '@/api/samisResponse';

describe('samisResponse auth codes', () => {
  it('treats missing, invalid and standard auth codes as auth failures', () => {
    for (const code of [401, 403, 9001, 9003]) {
      expect(isSamisAuthBusinessCode(code)).toBe(true);
    }
    expect(isSamisAuthBusinessCode(0)).toBe(false);
  });

  it('readSamisResponseMessage prefers msg then message', () => {
    expect(readSamisResponseMessage({ msg: 'a' })).toBe('a');
    expect(readSamisResponseMessage({ message: 'Token无效或已过期' }))
      .toBe('Token无效或已过期');
  });
});

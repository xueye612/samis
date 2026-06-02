import { describe, expect, it } from 'vitest';
import {
  isSamisAuthBusinessCode,
  readSamisResponseMessage,
} from '@/api/samisResponse';

describe('samisResponse auth codes', () => {
  it('treats 9003 as auth failure', () => {
    expect(isSamisAuthBusinessCode(9003)).toBe(true);
    expect(isSamisAuthBusinessCode(0)).toBe(false);
  });

  it('readSamisResponseMessage prefers msg then message', () => {
    expect(readSamisResponseMessage({ code: 1, msg: 'a', data: null })).toBe('a');
    expect(readSamisResponseMessage({ code: 9003, message: 'Token无效或已过期', data: null }))
      .toBe('Token无效或已过期');
  });
});

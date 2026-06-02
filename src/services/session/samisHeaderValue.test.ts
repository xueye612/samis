import { describe, expect, it } from 'vitest';
import { isLatin1HeaderValue, toSamisHeaderValue } from '@/services/session/samisHeaderValue';

describe('samisHeaderValue', () => {
  it('accepts ASCII room codes', () => {
    expect(isLatin1HeaderValue('OR-01')).toBe(true);
    expect(toSamisHeaderValue('01')).toBe('01');
  });

  it('encodes Chinese for header safety', () => {
    expect(isLatin1HeaderValue('手术中心')).toBe(false);
    expect(toSamisHeaderValue('手术中心')).toBe(encodeURIComponent('手术中心'));
  });
});

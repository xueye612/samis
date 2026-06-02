import { describe, expect, it } from 'vitest';
import {
  buildFormPost,
  stringifyFormJsonField,
  toFormUrlEncoded,
} from '@/api/samisFormBody';

describe('samisFormBody', () => {
  it('toFormUrlEncoded encodes scalar fields', () => {
    const body = toFormUrlEncoded({
      operationId: 'op-1',
      NUMBER_OF_STATIONS: 2,
    });
    expect(body).toContain('operationId=op-1');
    expect(body).toContain('NUMBER_OF_STATIONS=2');
  });

  it('buildFormPost sets form content type', () => {
    const init = buildFormPost({ data: stringifyFormJsonField([{ operationId: 'a' }]) });
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(String(init.body)).toContain('data=');
  });
});

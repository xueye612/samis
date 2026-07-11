import { describe, expect, it } from 'vitest';
import fixtures from '../../../tests/fixtures/pushbatch-structured-payloads.json';
import { validateStructuredPushItem } from './structuredPayloadValidator';

describe('structured payload shared contract', () => {
  for (const fixture of fixtures.cases) {
    it(fixture.caseId, () => {
      const result = validateStructuredPushItem(fixture.entityType, fixture.input, {
        rescueEventExists: (id) => id === 'r1', activeUserExists: (id) => ['u1', 'u2'].includes(id),
      });
      expect(result.valid).toBe(fixture.expectedValid);
      expect(result.code).toBe(fixture.expectedCode);
    });
  }
  it('rejects entity fields on delete', () => {
    expect(validateStructuredPushItem('airway_record', { localId:'a',operationId:'op1',action:'delete',clientVersion:1,occurredAt:'2026-07-11T09:00:00+08:00',payload:{deviceCode:'ETT'} }).code).toBe('2003');
  });
});

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
});

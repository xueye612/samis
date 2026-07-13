import { describe, expect, it } from 'vitest';
import { isRealModule, resolveApiMode } from '@/config/apiMode';
import { resolveSamisModule } from '@/config/apiFlags';

describe('apiMode', () => {
  it('uses every supported real adapter when global mock is disabled', () => {
    const config = resolveApiMode({ VITE_ANESTHESIA_USE_MOCK: 'false' });
    for (const module of ['auth', 'operationInfo', 'room', 'anesthesiaRecord', 'anesthesiaSync',
      'anesthesiaDevice', 'anesthesiaDict', 'pacu', 'postoperative', 'quality', 'preoperative', 'document', 'admin'] as const) {
      expect(isRealModule(config, module)).toBe(true);
    }
    expect(isRealModule(config, 'legacy')).toBe(false);
  });

  it('enables only explicitly selected modules in mock development mode', () => {
    const config = resolveApiMode({
      VITE_ANESTHESIA_USE_MOCK: 'true',
      VITE_USE_REAL_AUTH: 'true',
      VITE_USE_REAL_PREOPERATIVE: 'false',
    });
    expect(isRealModule(config, 'auth')).toBe(true);
    expect(isRealModule(config, 'preoperative')).toBe(false);
  });

  it('classifies both current and compatibility document paths', () => {
    expect(resolveSamisModule('/document/operationDocuments')).toBe('document');
    expect(resolveSamisModule('/clinicalDocument/operationDocuments')).toBe('document');
  });
});

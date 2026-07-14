import { beforeEach, describe, expect, it, vi } from 'vitest';

const captured: Array<{ path: string; body: string | undefined }> = [];

vi.mock('@/api/samisClient', () => ({
  samisRequest: vi.fn(async (path: string, init?: RequestInit) => {
    captured.push({ path, body: typeof init?.body === 'string' ? init.body : undefined });
    return { id: 1, version: 1 } as unknown;
  }),
}));

const { anesthesiaDictApi } = await import('@/api/anesthesiaDict');

function body(): URLSearchParams {
  return new URLSearchParams(captured[captured.length - 1]?.body ?? '');
}

describe('anesthesiaDict dictFormPostRich request body', () => {
  beforeEach(() => {
    captured.length = 0;
  });

  it('saveStaff serializes scopes as JSON and booleans as 1/0', async () => {
    await anesthesiaDictApi.saveStaff({
      gh: 'S1',
      name: '甲',
      emergencyCapable: false,
      is_active: true,
      scopes: [{ scopeType: 'practice', scopeCode: 'CARD' }],
    });
    const b = body();
    expect(b.get('gh')).toBe('S1');
    expect(b.get('emergencyCapable')).toBe('0');
    expect(b.get('is_active')).toBe('1');
    const scopes = JSON.parse(b.get('scopes') ?? '[]');
    expect(scopes).toHaveLength(1);
    expect(scopes[0].scopeCode).toBe('CARD');
  });

  it('saveProfessionalItem serializes ruleDefinition as JSON array', async () => {
    await anesthesiaDictApi.saveProfessionalItem({
      categoryCode: 'anesthesia_score',
      itemCode: 'APGAR',
      ruleDefinition: [{ dimension: '心率', scores: [0, 1, 2] }],
    });
    const b = body();
    const rule = JSON.parse(b.get('ruleDefinition') ?? '[]');
    expect(Array.isArray(rule)).toBe(true);
    expect(rule[0].dimension).toBe('心率');
    expect(rule[0].scores).toEqual([0, 1, 2]);
  });

  it('keeps empty string so backend can clear old values', async () => {
    await anesthesiaDictApi.saveStaff({ gh: 'S2', name: '乙', title: '', remark: '' });
    const b = body();
    expect(b.has('title')).toBe(true);
    expect(b.get('title')).toBe('');
    expect(b.has('remark')).toBe(true);
  });

  it('omits null and undefined fields', async () => {
    await anesthesiaDictApi.saveProfessionalItem({ categoryCode: 'anesthesia_method', itemCode: 'GA', itemName: '全麻', airwayStrategy: null, risks: undefined });
    const b = body();
    expect(b.has('airwayStrategy')).toBe(false);
    expect(b.has('risks')).toBe(false);
  });
});

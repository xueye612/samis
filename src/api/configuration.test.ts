import { beforeEach, describe, expect, it, vi } from 'vitest';

const captured: Array<{ path: string; body: string | undefined }> = [];

vi.mock('@/api/samisClient', () => ({
  samisRequest: vi.fn(async (path: string, init?: RequestInit) => {
    captured.push({ path, body: typeof init?.body === 'string' ? init.body : undefined });
    return { id: 1, version: 1, updatedAt: '2026-07-14 12:00:00' } as unknown;
  }),
}));

const { configurationApi } = await import('@/api/configuration');

describe('configuration api request serialization', () => {
  beforeEach(() => {
    captured.length = 0;
  });

  it('transmits candidate options as PHP form arrays instead of dropping them', async () => {
    await configurationApi.fieldConfigSave({
      hospitalCode: 'E2E',
      entityType: 'room',
      fieldCode: 'cleanLevel',
      expectedVersion: 0,
      options: ['百级', '千级'],
    });
    const body = new URLSearchParams(captured[0].body ?? '');
    expect(captured[0].path).toBe('/configuration/fieldConfigSave');
    expect(body.getAll('options[]')).toEqual(['百级', '千级']);
  });
});

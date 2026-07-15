import { beforeEach, describe, expect, it, vi } from 'vitest';

const captured: Array<{ path: string; body?: string }> = [];
vi.mock('@/api/samisClient', () => ({
  samisRequest: vi.fn(async (path: string, init?: RequestInit) => {
    captured.push({ path, body: typeof init?.body === 'string' ? init.body : undefined });
    return { list: [], total: 0 };
  }),
}));

const { anesthesiaDeviceV2Api } = await import('@/api/anesthesiaDevice');

describe('P09 device v2 api', () => {
  beforeEach(() => { captured.length = 0; });

  it('loads the real registry and active alerts instead of legacy demo endpoints', async () => {
    await anesthesiaDeviceV2Api.registryList({ status: 'online', pageSize: 100 });
    await anesthesiaDeviceV2Api.alertList({ status: 'active', pageSize: 100 });
    expect(captured[0].path).toContain('/anesthesiaDeviceV2/registryList?');
    expect(captured[0].path).toContain('status=online');
    expect(captured[1].path).toContain('/anesthesiaDeviceV2/alertList?');
  });

  it('requires explicit unbind reason in the transmitted body', async () => {
    await anesthesiaDeviceV2Api.unbind({ bindingId: 'BND-1', reason: '手术结束' });
    const body = new URLSearchParams(captured[0].body ?? '');
    expect(body.get('bindingId')).toBe('BND-1');
    expect(body.get('reason')).toBe('手术结束');
  });
});

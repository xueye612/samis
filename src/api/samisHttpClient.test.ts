import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authFailureMocks = vi.hoisted(() => ({
  coordinate: vi.fn(async (_message: string, _actions: unknown) => undefined),
}));

vi.mock('@/services/auth/authFailureCoordinator', () => ({
  coordinateAuthFailure: authFailureMocks.coordinate,
}));

import { joinSamisUrl, normalizeSamisPath, samisHttpFetch } from '@/api/samisHttpClient';

describe('samisHttpClient', () => {
  it('strips duplicate api-samis prefix from path', () => {
    expect(normalizeSamisPath('/api-samis/pc/v1/operationInfo/getOperationList')).toBe(
      '/operationInfo/getOperationList',
    );
  });

  it('joins base and path without double prefix', () => {
    const url = joinSamisUrl('http://host/api-samis/pc/v1', '/operationInfo/getOperationList');
    expect(url).toBe('http://host/api-samis/pc/v1/operationInfo/getOperationList');
    expect(url.match(/\/api-samis\/pc\/v1/g)?.length).toBe(1);
  });

  it('handles already-prefixed path against relative base', () => {
    const url = joinSamisUrl('/api-samis/pc/v1', '/api-samis/pc/v1/room/getRoomList');
    expect(url).toBe('/api-samis/pc/v1/room/getRoomList');
  });

  beforeEach(() => authFailureMocks.coordinate.mockClear());
  afterEach(() => vi.unstubAllGlobals());

  it('classifies HTTP 400 business code 9001 as auth failure and coordinates it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ code: 9001, msg: 'Token缺失', data: null }),
    })));

    await expect(samisHttpFetch('/operationInfo/getOperationList')).rejects.toMatchObject({
      status: 400,
      code: 9001,
      isAuthError: true,
    });

    expect(authFailureMocks.coordinate).toHaveBeenCalledTimes(1);
    expect(authFailureMocks.coordinate.mock.calls[0]?.[0]).toBe('Token缺失');
  });
});

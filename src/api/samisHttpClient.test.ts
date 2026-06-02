import { describe, expect, it } from 'vitest';
import { joinSamisUrl, normalizeSamisPath } from '@/api/samisHttpClient';

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
});

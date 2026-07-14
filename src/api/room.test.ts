import { beforeEach, describe, expect, it, vi } from 'vitest';

const captured: Array<{ path: string; body: string | undefined }> = [];

vi.mock('@/api/samisClient', () => ({
  samisRequest: vi.fn(async (path: string, init?: RequestInit) => {
    captured.push({ path, body: typeof init?.body === 'string' ? init.body : undefined });
    return { roomId: 1, version: 1 } as unknown;
  }),
}));

const { roomApi } = await import('@/api/room');

function parseBody(body: string | undefined): URLSearchParams {
  return new URLSearchParams(body ?? '');
}

describe('room api request body serialization', () => {
  beforeEach(() => {
    captured.length = 0;
  });

  it('transmits capabilities as JSON and booleans as 1/0', async () => {
    await roomApi.roomCreate({
      roomCode: 'R1',
      roomName: '一号',
      emergencyCapable: false,
      negativePressure: true,
      capabilities: [
        { capabilityType: 'operation_type', capabilityCode: 'GA', capabilityName: '全麻' },
      ],
    });
    const body = parseBody(captured[0].body);
    expect(body.get('roomCode')).toBe('R1');
    expect(body.get('emergencyCapable')).toBe('0');
    expect(body.get('negativePressure')).toBe('1');
    const caps = JSON.parse(body.get('capabilities') ?? '[]');
    expect(caps).toHaveLength(1);
    expect(caps[0].capabilityCode).toBe('GA');
  });

  it('keeps empty string fields so the backend can clear old values', async () => {
    await roomApi.roomUpdate({
      roomId: 12,
      expectedVersion: 3,
      location: '',
      remark: '',
      capabilities: [],
    });
    const body = parseBody(captured[0].body);
    expect(body.has('location')).toBe(true);
    expect(body.get('location')).toBe('');
    expect(body.has('remark')).toBe(true);
    // 空 capabilities 数组以 JSON 传输，后端据此清除全部能力
    expect(JSON.parse(body.get('capabilities') ?? '[]')).toEqual([]);
  });

  it('omits null/undefined fields', async () => {
    await roomApi.roomCreate({ roomCode: 'R2', roomName: '二号', campus: null });
    const body = parseBody(captured[0].body);
    expect(body.has('campus')).toBe(false);
  });
});

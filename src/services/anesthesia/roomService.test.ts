import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/apiFlags', () => ({
  useRealRoom: () => __REAL_ROOM__,
  ANESTHESIA_USE_MOCK: false,
  SAMIS_API_BASE: '/api-samis/pc/v1',
  SAMIS_REQUEST_TIMEOUT_MS: 30000,
  AUTH_LOGIN_BYPASS: false,
  resolveSamisModule: (p: string) => p,
  useRealForModule: () => __REAL_ROOM__,
}));

vi.mock('@/services/session/samisSession', () => ({
  isSamisLoggedIn: () => __LOGGED_IN__,
}));

vi.mock('@/api/room', () => ({
  roomApi: {
    getRoomList: () => __ROOM_LIST__,
    getRoomGroupList: () => __ROOM_GROUPS__,
  },
}));

let __REAL_ROOM__ = true;
let __LOGGED_IN__ = true;
let __ROOM_LIST__: unknown = { list: [] };
let __ROOM_GROUPS__: unknown = { list: [] };

const roomService = await import('@/services/anesthesia/roomService');

describe('roomService real-mode integrity', () => {
  beforeEach(() => {
    __REAL_ROOM__ = true;
    __LOGGED_IN__ = true;
    __ROOM_LIST__ = { list: [] };
    __ROOM_GROUPS__ = { list: [] };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('real mode empty remote list yields empty names, never DEFAULT_ROOMS', async () => {
    __ROOM_LIST__ = { list: [] };
    __ROOM_GROUPS__ = { list: [] };
    const catalog = await roomService.loadRoomCatalog();
    expect(catalog.source).toBe('remote');
    expect(catalog.roomNames).toEqual([]);
    expect(catalog.rooms).toEqual([]);
  });

  it('real mode error throws and does not backfill DEFAULT_ROOMS', async () => {
    vi.resetModules();
    vi.doMock('@/api/room', () => ({
      roomApi: {
        getRoomList: () => Promise.reject(new Error('boom')),
        getRoomGroupList: () => Promise.resolve({ list: [] }),
      },
    }));
    const failing = await import('@/services/anesthesia/roomService');
    await expect(failing.loadRoomCatalog()).rejects.toThrow('boom');
  });

  it('loginRoomCatalogFallback is only used without token (not logged in)', async () => {
    __LOGGED_IN__ = false;
    const catalog = await roomService.loadRoomCatalog();
    expect(catalog.source).toBe('mock');
    expect(catalog.roomNames.length).toBeGreaterThan(0);
  });

  it('preserves real room names when remote returns data', async () => {
    __ROOM_LIST__ = { list: [{ OPERATION_ROOM_CODE: 'A1', OPERATION_ROOM_NAME: 'A1' }] };
    const catalog = await roomService.loadRoomCatalog();
    expect(catalog.source).toBe('remote');
    expect(catalog.roomNames).toContain('A1');
  });
});

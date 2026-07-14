import { beforeEach, describe, expect, it, vi } from 'vitest';

const roomApiMock = {
  getRoomList: vi.fn(),
  getRoomById: vi.fn(),
  roomCreate: vi.fn(),
  roomUpdate: vi.fn(),
  roomChangeStatus: vi.fn(),
  roomHistory: vi.fn(),
};
const configurationApiMock = {
  fieldConfig: vi.fn(),
  fieldConfigSave: vi.fn(),
};

vi.mock('@/api/room', () => ({ roomApi: roomApiMock }));
vi.mock('@/api/configuration', () => ({ configurationApi: configurationApiMock }));
vi.mock('@/api/samisHttpClient', () => ({
  SamisHttpError: class SamisHttpError extends Error {
    constructor(message: string, public status: number, public code?: number) {
      super(message);
    }
  },
}));

const {
  loadRoomConfigurationList,
  getRoomConfigurationDetail,
  createRoomConfiguration,
  updateRoomConfiguration,
  changeRoomStatus,
  loadRoomConfigurationHistory,
  loadHospitalFieldConfig,
  saveHospitalFieldConfig,
  canManageRoom,
  canManageField,
  RoomConfigConflictError,
} = await import('@/services/configuration/roomConfigurationService');

describe('roomConfigurationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('empty remote list stays empty, no default rooms', async () => {
    roomApiMock.getRoomList.mockResolvedValue({ list: [] });
    const list = await loadRoomConfigurationList();
    expect(list).toEqual([]);
  });

  it('maps rich fields preserving false/0 and version', async () => {
    roomApiMock.getRoomList.mockResolvedValue({
      list: [{ roomCode: 'R1', emergencyCapable: false, stationCapacity: 0, version: 2 }],
    });
    const list = await loadRoomConfigurationList();
    expect(list[0].roomCode).toBe('R1');
    expect(list[0].emergencyCapable).toBe(false);
    expect(list[0].stationCapacity).toBe(0);
    expect(list[0].version).toBe(2);
  });

  it('create returns version; conflict maps to RoomConfigConflictError', async () => {
    roomApiMock.roomCreate.mockResolvedValue({ roomId: 12, version: 1 });
    const created = await createRoomConfiguration({ roomCode: 'R1' });
    expect(created.roomId).toBe(12);
    expect(created.version).toBe(1);

    const { SamisHttpError } = await import('@/api/samisHttpClient');
    roomApiMock.roomCreate.mockRejectedValueOnce(new SamisHttpError('conflict', 200, 4091));
    await expect(createRoomConfiguration({ roomCode: 'R1' })).rejects.toBeInstanceOf(RoomConfigConflictError);
  });

  it('update returns version', async () => {
    roomApiMock.roomUpdate.mockResolvedValue({ version: 5 });
    const updated = await updateRoomConfiguration({ roomId: 12, expectedVersion: 4 });
    expect(updated.version).toBe(5);
  });

  it('changeStatus returns status and version', async () => {
    roomApiMock.roomChangeStatus.mockResolvedValue({ status: 'paused', version: 3 });
    const r = await changeRoomStatus({ id: 12, toStatus: 'paused', reason: 'x', expectedVersion: 2 });
    expect(r.status).toBe('paused');
    expect(r.version).toBe(3);
  });

  it('history preserves order', async () => {
    roomApiMock.roomHistory.mockResolvedValue({
      list: [
        { id: 1, toStatus: 'enabled', version: 1, occurredAt: '2026-07-14 10:00:00' },
        { id: 2, toStatus: 'disabled', version: 2, occurredAt: '2026-07-14 11:00:00' },
      ],
    });
    const history = await loadRoomConfigurationHistory(12);
    expect(history).toHaveLength(2);
    expect(history[1].toStatus).toBe('disabled');
  });

  it('field config load returns baseline merged data', async () => {
    configurationApiMock.fieldConfig.mockResolvedValue({ list: [{ fieldCode: 'roomCode', required: true }] });
    const cfg = await loadHospitalFieldConfig('E2E');
    expect(cfg).toEqual(expect.arrayContaining([expect.objectContaining({ fieldCode: 'roomCode' })]));
  });

  it('permission helpers honor wildcard and explicit codes', () => {
    expect(canManageRoom(['*'])).toBe(true);
    expect(canManageRoom(['config.room.manage'])).toBe(true);
    expect(canManageRoom(['other'])).toBe(false);
    expect(canManageRoom(null)).toBe(false);
    expect(canManageField(['config.field.manage'])).toBe(true);
    expect(canManageField(['config.room.manage'])).toBe(false);
  });
});

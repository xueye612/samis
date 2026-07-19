import { describe, expect, it } from 'vitest';
import {
  mapRoomConfiguration,
  mapRoomConfigurationList,
  mapRoomHistory,
  mapRoomGroupListResponse,
  mapRoomItem,
} from '@/services/anesthesia/adapters/roomAdapter';

describe('roomAdapter', () => {
  it('mapRoomItem reads OPERATION_ROOM_* fields', () => {
    const item = mapRoomItem({
      OPERATION_ROOM_ID: 64,
      OPERATION_ROOM_NAME: 'A1',
      OPERATION_ROOM_CODE: 'A1',
      OPERATION_ROOM_GROUP: '113901912',
    });
    expect(item.roomId).toBe('A1');
    expect(item.roomName).toBe('A1');
    expect(item.roomGroupId).toBe('113901912');
  });

  it('mapRoomGroupListResponse reads nested list', () => {
    const groups = mapRoomGroupListResponse([
      {
        OPERATION_ROOM_GROUP: '113901912',
        OPERATION_ROOM_GROUP_NAME: '手术部',
        list: [{ OPERATION_ROOM_CODE: 'B1', OPERATION_ROOM_NAME: 'B1' }],
      },
    ]);
    expect(groups[0].roomGroupId).toBe('113901912');
    expect(groups[0].roomGroupName).toBe('手术部');
    expect(groups[0].rooms[0].roomId).toBe('B1');
  });

  it('mapRoomConfiguration preserves rich fields, false/0/null and integer version; never fabricates code', () => {
    const room = mapRoomConfiguration({
      roomId: 9012,
      roomCode: 'ROOM-X',
      roomName: '一号',
      shortName: null,
      emergencyCapable: false,
      negativePressure: 0,
      hybridRoom: true,
      stationCapacity: 0,
      version: 3,
      capabilities: [
        { capabilityType: 'operation_type', capabilityCode: 'OP-GA', capabilityName: '全麻' },
      ],
      equipment: [
        { deviceId: 71, deviceCode: 'MON-01', deviceName: '一号监护仪', deviceType: 'monitor', status: 'enabled', currentRoomId: 9012, version: 4, bindingId: 8 },
      ],
    });
    expect(room.roomCode).toBe('ROOM-X');
    expect(room.roomId).toBe(9012);
    expect(room.shortName).toBeNull();
    expect(room.emergencyCapable).toBe(false);
    expect(room.negativePressure).toBe(false);
    expect(room.hybridRoom).toBe(true);
    expect(room.stationCapacity).toBe(0);
    expect(room.version).toBe(3);
    expect(room.capabilities).toHaveLength(1);
    expect(room.capabilities[0].capabilityCode).toBe('OP-GA');
    expect(room.equipment).toEqual([
      expect.objectContaining({ deviceId: 71, deviceCode: 'MON-01', currentRoomId: 9012, bindingId: 8 }),
    ]);
  });

  it('mapRoomConfiguration does not fabricate roomCode from name', () => {
    const room = mapRoomConfiguration({ roomName: '仅名称无编码' });
    expect(room.roomCode).toBe('');
    expect(room.roomName).toBe('仅名称无编码');
  });

  it('mapRoomConfigurationList unwraps payload and returns empty for empty remote list', () => {
    expect(mapRoomConfigurationList({ list: [] })).toEqual([]);
    expect(mapRoomConfigurationList([])).toEqual([]);
  });

  it('mapRoomItem prefers stable roomCode and does not use numeric id or fabricate from name', () => {
    const item = mapRoomItem({ roomId: 9012, roomCode: 'ROOM-A', OPERATION_ROOM_ID: 64, roomName: '甲' });
    expect(item.roomId).toBe('ROOM-A');
    expect(item.roomName).toBe('甲');
    const noCode = mapRoomItem({ roomId: 9012, OPERATION_ROOM_ID: 64, roomName: '乙' });
    expect(noCode.roomId).toBe('');
    expect(noCode.roomName).toBe('乙');
  });

  it('mapRoomConfiguration does not fabricate status/version when absent', () => {
    const room = mapRoomConfiguration({ roomCode: 'C', roomName: '丙' });
    expect(room.status).toBe('');
    expect(room.version).toBe(0);
  });

  it('mapRoomHistory preserves order, version and occurredAt', () => {
    const history = mapRoomHistory([
      { id: 1, fromStatus: null, toStatus: 'enabled', reason: null, actor: 'a', version: 1, occurredAt: '2026-07-14 10:00:00' },
      { id: 2, fromStatus: 'enabled', toStatus: 'paused', reason: '检修', actor: 'a', version: 2, occurredAt: '2026-07-14 11:00:00' },
    ]);
    expect(history).toHaveLength(2);
    expect(history[1].toStatus).toBe('paused');
    expect(history[1].version).toBe(2);
  });
});

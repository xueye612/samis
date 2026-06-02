import { describe, expect, it } from 'vitest';
import { mapRoomGroupListResponse, mapRoomItem } from '@/services/anesthesia/adapters/roomAdapter';

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
});

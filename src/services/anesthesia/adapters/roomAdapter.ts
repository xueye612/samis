import { pickString, unwrapListPayload } from '@/services/anesthesia/adapters/fieldUtils';

export interface RoomCatalogItem {
  roomId: string;
  roomName: string;
  roomGroup?: string;
  roomGroupId?: string;
}

export interface RoomGroupCatalog {
  roomGroupId: string;
  roomGroupName: string;
  rooms: RoomCatalogItem[];
}

export function mapRoomItem(raw: unknown): RoomCatalogItem {
  const roomId = pickString(raw, [
    'OPERATION_ROOM_CODE',
    'OPERATION_ROOM_ID',
    'roomId',
    'ROOMID',
    'id',
    'roomCode',
  ], '');
  const roomName = pickString(raw, ['OPERATION_ROOM_NAME', 'roomName', 'ROOMNAME', 'name', 'room'], roomId);
  return {
    roomId: roomId || roomName,
    roomName: roomName || roomId,
    roomGroup: pickString(raw, ['OPERATION_ROOM_GROUP_NAME', 'roomGroup', 'room_group', 'groupName']),
    roomGroupId: pickString(raw, ['OPERATION_ROOM_GROUP', 'roomGroupId', 'room_group_id', 'groupId']),
  };
}

export function mapRoomListResponse(data: unknown): RoomCatalogItem[] {
  return unwrapListPayload(data).map(mapRoomItem).filter((item) => item.roomId || item.roomName);
}

export function mapRoomGroupListResponse(data: unknown): RoomGroupCatalog[] {
  const groups = unwrapListPayload(data);
  return groups.map((raw, index) => {
    const record = raw as Record<string, unknown>;
    const roomGroupId = pickString(record, [
      'OPERATION_ROOM_GROUP',
      'roomGroupId',
      'groupId',
      'id',
      'ID',
    ], `group-${index}`);
    const roomGroupName = pickString(record, [
      'OPERATION_ROOM_GROUP_NAME',
      'OPERATION_ROOM_TYPE_NAME',
      'roomGroupName',
      'groupName',
      'name',
    ], roomGroupId);
    const nested = unwrapListPayload(record.list ?? record.rooms ?? record.roomList);
    const rooms = nested.length ? nested.map(mapRoomItem) : [];
    return { roomGroupId, roomGroupName, rooms };
  });
}

export function roomNamesFromCatalog(items: RoomCatalogItem[]): string[] {
  const names = items.map((item) => item.roomName || item.roomId).filter(Boolean);
  return [...new Set(names)];
}

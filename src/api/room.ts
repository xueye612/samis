import { samisRequest } from '@/api/samisClient';

export interface RoomQuery {
  roomGroup?: string;
  roomGroupId?: string;
  keyword?: string;
}

function buildRoomQuery(params: RoomQuery = {}): string {
  const query = new URLSearchParams();
  if (params.roomGroup) query.set('roomGroup', params.roomGroup);
  if (params.roomGroupId) query.set('roomGroupId', params.roomGroupId);
  if (params.keyword) query.set('keyword', params.keyword);
  const text = query.toString();
  return text ? `?${text}` : '';
}

export const roomApi = {
  getRoomList(params: RoomQuery = {}) {
    return samisRequest<unknown>(`/room/getRoomList${buildRoomQuery(params)}`, undefined, {
      module: 'room',
    });
  },
  getRoomGroupList(params: RoomQuery = {}) {
    return samisRequest<unknown>(`/room/getRoomGroupList${buildRoomQuery(params)}`, undefined, {
      module: 'room',
    });
  },
};

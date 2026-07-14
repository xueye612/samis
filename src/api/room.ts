import { samisRequest } from '@/api/samisClient';
import { buildFormPost, flatFormFieldsFromRecord } from '@/api/samisFormBody';

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

function roomFormPost<T>(path: string, data: Record<string, unknown>) {
  return samisRequest<T>(`/room${path}`, buildFormPost(flatFormFieldsFromRecord(data)), {
    module: 'room',
  });
}

export const roomApi = {
  getRoomList(params: RoomQuery = {}) {
    return samisRequest<unknown>(`/room/getRoomList${buildRoomQuery(params)}`, undefined, {
      module: 'room',
    });
  },
  getRoomById(id: string | number) {
    return samisRequest<unknown>(`/room/getRoomById?id=${encodeURIComponent(String(id))}`, undefined, {
      module: 'room',
    });
  },
  getRoomGroupList(params: RoomQuery = {}) {
    return samisRequest<unknown>(`/room/getRoomGroupList${buildRoomQuery(params)}`, undefined, {
      module: 'room',
    });
  },
  roomCreate(data: Record<string, unknown>) {
    return roomFormPost<{ roomId?: string | number; version?: number; id?: string | number }>('/roomCreate', data);
  },
  roomUpdate(data: Record<string, unknown>) {
    return roomFormPost<{ version?: number }>('/roomUpdate', data);
  },
  roomChangeStatus(data: Record<string, unknown>) {
    return roomFormPost<{ status?: string; version?: number }>('/roomChangeStatus', data);
  },
  roomHistory(id: string | number) {
    return samisRequest<unknown>(`/room/roomHistory?id=${encodeURIComponent(String(id))}`, undefined, {
      module: 'room',
    });
  },
  roomDelete(id: string | number) {
    return roomFormPost<void>('/roomDelete', { id });
  },
  roomGroupCreate(data: Record<string, unknown>) {
    return roomFormPost<{ id?: string | number }>('/roomGroupCreate', data);
  },
  roomGroupUpdate(data: Record<string, unknown>) {
    return roomFormPost<void>('/roomGroupUpdate', data);
  },
  roomGroupDelete(id: string | number) {
    return roomFormPost<void>('/roomGroupDelete', { id });
  },
};

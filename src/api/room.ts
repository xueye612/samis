import { samisRequest } from '@/api/samisClient';
import { formPostInit } from '@/api/samisFormBody';

export interface RoomQuery {
  roomGroup?: string;
  roomGroupId?: string;
  keyword?: string;
  allStatus?: boolean | number;
}

function buildRoomQuery(params: RoomQuery = {}): string {
  const query = new URLSearchParams();
  if (params.roomGroup) query.set('roomGroup', params.roomGroup);
  if (params.roomGroupId) query.set('roomGroupId', params.roomGroupId);
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.allStatus) query.set('allStatus', '1');
  const text = query.toString();
  return text ? `?${text}` : '';
}

/**
 * 房间表单序列化：
 * - capabilities 以受控 JSON 字符串传输（后端 resolveCapabilities 解析）。
 * - 布尔转 '1'/'0'，避免 'false' 被后端判为真。
 * - 空串保留以支持清除后端旧值；null/undefined 跳过。
 */
function flattenRoomFields(data: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (key === 'capabilities' || Array.isArray(value)) {
      params.set(key, JSON.stringify(value));
      return;
    }
    if (typeof value === 'boolean') {
      params.set(key, value ? '1' : '0');
      return;
    }
    params.set(key, String(value));
  });
  return params.toString();
}

function roomFormPost<T>(path: string, data: Record<string, unknown>) {
  return samisRequest<T>(`/room${path}`, formPostInit(flattenRoomFields(data)), {
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

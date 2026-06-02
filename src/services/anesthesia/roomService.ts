import { Message } from '@arco-design/web-vue';
import { roomApi } from '@/api/room';
import { useRealRoom } from '@/config/apiFlags';
import { SamisHttpError } from '@/api/samisHttpClient';
import { isSamisLoggedIn } from '@/services/session/samisSession';
import {
  mapRoomGroupListResponse,
  mapRoomListResponse,
  roomNamesFromCatalog,
  type RoomGroupCatalog,
} from '@/services/anesthesia/adapters/roomAdapter';

export interface RoomCatalogState {
  roomNames: string[];
  rooms: ReturnType<typeof mapRoomListResponse>;
  groups: RoomGroupCatalog[];
  source: 'remote' | 'mock';
}

const DEFAULT_ROOMS = ['OR-01', 'OR-02', 'OR-03', 'OR-04', 'OR-05', 'OR-06', 'PACU', '产房', '内镜中心'];

/** 登录页未持 token 时使用；避免 getRoomGroupList 返回 9003/400 */
export function loginRoomCatalogFallback(): RoomCatalogState {
  const rooms = [
    { roomId: '01', roomName: '01' },
    { roomId: 'A1', roomName: 'A1' },
    { roomId: 'OR-01', roomName: 'OR-01' },
  ];
  return {
    roomNames: rooms.map((r) => r.roomName),
    rooms,
    groups: [{
      roomGroupId: 'ANES',
      roomGroupName: '手术部',
      rooms,
    }],
    source: 'seed',
  };
}

export async function loadRoomCatalog(): Promise<RoomCatalogState> {
  if (useRealRoom() && !isSamisLoggedIn()) {
    return loginRoomCatalogFallback();
  }

  if (!useRealRoom()) {
    const [listRaw, groupRaw] = await Promise.all([
      roomApi.getRoomList(),
      roomApi.getRoomGroupList(),
    ]);
    const rooms = mapRoomListResponse(listRaw);
    const groups = mapRoomGroupListResponse(groupRaw);
    const roomNames = roomNamesFromCatalog(rooms);
    return {
      roomNames: roomNames.length ? roomNames : DEFAULT_ROOMS,
      rooms,
      groups,
      source: 'mock',
    };
  }

  try {
    const [listRaw, groupRaw] = await Promise.all([
      roomApi.getRoomList(),
      roomApi.getRoomGroupList(),
    ]);
    const rooms = mapRoomListResponse(listRaw);
    const groups = mapRoomGroupListResponse(groupRaw);
    const roomNames = roomNamesFromCatalog(rooms);
    return {
      roomNames: roomNames.length ? roomNames : DEFAULT_ROOMS,
      rooms,
      groups,
      source: 'remote',
    };
  } catch (error) {
    const msg = error instanceof SamisHttpError
      ? error.message
      : error instanceof Error
        ? error.message
        : '加载手术间失败';
    Message.warning(`${msg}，已使用默认手术间`);
    return {
      roomNames: DEFAULT_ROOMS,
      rooms: DEFAULT_ROOMS.map((name) => ({ roomId: name, roomName: name })),
      groups: [],
      source: 'mock',
    };
  }
}

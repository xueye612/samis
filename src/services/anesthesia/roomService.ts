import { roomApi } from '@/api/room';
import { useRealRoom } from '@/config/apiFlags';
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

/** 登录页未持 token 时使用；避免 getRoomGroupList 返回 9003/400。仅允许登录页无 token 使用。 */
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
    source: 'mock',
  };
}

export async function loadRoomCatalog(): Promise<RoomCatalogState> {
  // 仅登录页未持 token 时使用兜底，避免受保护接口返回 9003/400。
  if (useRealRoom() && !isSamisLoggedIn()) {
    return loginRoomCatalogFallback();
  }

  const [listRaw, groupRaw] = await Promise.all([
    roomApi.getRoomList(),
    roomApi.getRoomGroupList(),
  ]);
  const rooms = mapRoomListResponse(listRaw);
  const groups = mapRoomGroupListResponse(groupRaw);

  if (!useRealRoom()) {
    // mock 模式：空列表回退默认房间（仅 mock 模式允许）。
    const roomNames = roomNamesFromCatalog(rooms);
    return {
      roomNames: roomNames.length ? roomNames : DEFAULT_ROOMS,
      rooms,
      groups,
      source: 'mock',
    };
  }

  // 真实模式：空列表保持空，错误向上抛出由调用方显示 error 并保留重试，绝不回填默认房间。
  return {
    roomNames: roomNamesFromCatalog(rooms),
    rooms,
    groups,
    source: 'remote',
  };
}

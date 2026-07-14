import { roomApi } from '@/api/room';
import { configurationApi } from '@/api/configuration';
import { SamisHttpError } from '@/api/samisHttpClient';
import { unwrapListPayload } from '@/services/anesthesia/adapters/fieldUtils';
import {
  mapRoomConfiguration,
  mapRoomConfigurationList,
  mapRoomHistory,
  type RoomConfiguration,
  type RoomStatusHistoryItem,
} from '@/services/anesthesia/adapters/roomAdapter';

export const ROOM_MANAGE_PERMISSION = 'config.room.manage';
export const FIELD_MANAGE_PERMISSION = 'config.field.manage';
export const ROOM_CONFIG_CONFLICT_CODE = 4091;

export class RoomConfigConflictError extends Error {
  constructor(message = '数据已被其他人修改，请刷新后重试') {
    super(message);
    this.name = 'RoomConfigConflictError';
  }
}

/** 是否拥有手术间配置管理权限（通配 * 或显式权限码）。 */
export function canManageRoom(permissions: string[] | null | undefined): boolean {
  return hasPermission(permissions, ROOM_MANAGE_PERMISSION);
}

/** 是否拥有医院字段配置管理权限。 */
export function canManageField(permissions: string[] | null | undefined): boolean {
  return hasPermission(permissions, FIELD_MANAGE_PERMISSION);
}

function hasPermission(permissions: string[] | null | undefined, code: string): boolean {
  if (!permissions) return false;
  return permissions.some((p) => p === '*' || p === code);
}

function unwrapData(response: unknown): unknown {
  if (response && typeof response === 'object') {
    const record = response as Record<string, unknown>;
    if (record.data !== undefined) return record.data;
  }
  return response;
}

function throwIfConflict(error: unknown): never {
  if (error instanceof SamisHttpError && error.code === ROOM_CONFIG_CONFLICT_CODE) {
    throw new RoomConfigConflictError();
  }
  throw error;
}

/** 真实加载手术间配置列表；空列表保持空，不造默认房间。 */
export async function loadRoomConfigurationList(params: { keyword?: string; status?: string } = {}): Promise<RoomConfiguration[]> {
  const raw = await roomApi.getRoomList(params);
  return mapRoomConfigurationList(unwrapData(raw));
}

export async function getRoomConfigurationDetail(id: number | string): Promise<RoomConfiguration | null> {
  const raw = await roomApi.getRoomById(id);
  const data = unwrapData(raw);
  if (!data || (typeof data === 'object' && Object.keys(data as object).length === 0)) return null;
  return mapRoomConfiguration(data);
}

export interface RoomSaveResult {
  roomId?: number;
  version: number;
}

export async function createRoomConfiguration(payload: Record<string, unknown>): Promise<RoomSaveResult> {
  try {
    const result = await roomApi.roomCreate(payload);
    const data = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
    const id = data.roomId ?? data.id;
    return { roomId: id === undefined ? undefined : Number(id), version: Number(data.version ?? 1) };
  } catch (error) {
    throwIfConflict(error);
  }
}

export async function updateRoomConfiguration(payload: Record<string, unknown>): Promise<RoomSaveResult> {
  try {
    const result = await roomApi.roomUpdate(payload);
    const data = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
    return { version: Number(data.version ?? 0) };
  } catch (error) {
    throwIfConflict(error);
  }
}

export async function changeRoomStatus(payload: Record<string, unknown>): Promise<{ status: string; version: number }> {
  try {
    const result = await roomApi.roomChangeStatus(payload);
    const data = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
    return { status: String(data.status ?? ''), version: Number(data.version ?? 0) };
  } catch (error) {
    throwIfConflict(error);
  }
}

export async function loadRoomConfigurationHistory(id: number | string): Promise<RoomStatusHistoryItem[]> {
  const raw = await roomApi.roomHistory(id);
  return mapRoomHistory(unwrapData(raw));
}

export async function loadHospitalFieldConfig(hospitalCode: string, entityType = 'room') {
  const raw = await configurationApi.fieldConfig(hospitalCode, entityType);
  return unwrapListPayload(unwrapData(raw));
}

export async function saveHospitalFieldConfig(payload: Record<string, unknown>) {
  try {
    return await configurationApi.fieldConfigSave(payload);
  } catch (error) {
    throwIfConflict(error);
  }
}

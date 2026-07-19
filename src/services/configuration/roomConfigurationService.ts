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

export interface RoomFieldConfigEntry {
  fieldCode: string;
  displayName: string;
  dataType: string;
  serverRequired: boolean;
  systemField: boolean;
  visible: boolean;
  required: boolean;
  sortNo: number;
  groupName: string | null;
  defaultValue: string | null;
  options: string[];
  version: number | null;
  id: number | null;
  updatedAt: string | null;
}

export interface RoomFieldGroup {
  groupName: string;
  fields: RoomFieldConfigEntry[];
}

export class RoomConfigConflictError extends Error {
  constructor(message = '数据已被其他人修改，请刷新后重试') {
    super(message);
    this.name = 'RoomConfigConflictError';
  }
}

export class CoreRoomReadOnlyError extends Error {
  constructor(message = '核心手术间由手术护理系统维护，麻醉系统仅可读取') {
    super(message);
    this.name = 'CoreRoomReadOnlyError';
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

/** 真实加载手术间配置列表；空列表保持空，不造默认房间。配置管理页传 allStatus 查全部生命周期状态。 */
export async function loadRoomConfigurationList(params: { keyword?: string; status?: string; allStatus?: boolean } = {}): Promise<RoomConfiguration[]> {
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
  void payload;
  throw new CoreRoomReadOnlyError();
}

export async function updateRoomConfiguration(payload: Record<string, unknown>): Promise<RoomSaveResult> {
  void payload;
  throw new CoreRoomReadOnlyError();
}

export async function changeRoomStatus(payload: Record<string, unknown>): Promise<{ status: string; version: number }> {
  void payload;
  throw new CoreRoomReadOnlyError();
}

export async function loadRoomConfigurationHistory(id: number | string): Promise<RoomStatusHistoryItem[]> {
  const raw = await roomApi.roomHistory(id);
  return mapRoomHistory(unwrapData(raw));
}

export async function loadHospitalFieldConfig(hospitalCode: string, entityType = 'room') {
  const raw = await configurationApi.fieldConfig(hospitalCode, entityType);
  return normalizeRoomFieldConfigs(unwrapListPayload(unwrapData(raw)));
}

export async function saveHospitalFieldConfig(payload: Record<string, unknown>) {
  try {
    return await configurationApi.fieldConfigSave(payload);
  } catch (error) {
    throwIfConflict(error);
  }
}

export function normalizeRoomFieldConfigs(raw: unknown): RoomFieldConfigEntry[] {
  const list = Array.isArray(raw) ? raw : unwrapListPayload(raw);
  return list.map((item, index) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      fieldCode: String(row.fieldCode ?? ''),
      displayName: String(row.displayName ?? row.fieldCode ?? ''),
      dataType: String(row.dataType ?? 'string'),
      serverRequired: Boolean(row.serverRequired),
      systemField: Boolean(row.systemField),
      visible: row.visible === undefined ? true : Boolean(row.visible),
      required: Boolean(row.required),
      sortNo: Number.isFinite(Number(row.sortNo)) ? Number(row.sortNo) : index,
      groupName: row.groupName === null || row.groupName === undefined || row.groupName === '' ? null : String(row.groupName),
      defaultValue: row.defaultValue === null || row.defaultValue === undefined ? null : String(row.defaultValue),
      options: normalizeOptions(row.options),
      version: row.version === null || row.version === undefined ? null : Number(row.version),
      id: row.id === null || row.id === undefined ? null : Number(row.id),
      updatedAt: row.updatedAt === null || row.updatedAt === undefined ? null : String(row.updatedAt),
    };
  }).filter((item) => item.fieldCode);
}

function normalizeOptions(value: unknown): string[] {
  let values: unknown = value;
  if (typeof value === 'string' && value.trim()) {
    try {
      values = JSON.parse(value);
    } catch {
      values = [];
    }
  }
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

export function groupRoomTableFields(fields: RoomFieldConfigEntry[]): RoomFieldGroup[] {
  const sorted = [...fields].filter((field) => field.visible).sort((a, b) => a.sortNo - b.sortNo);
  const groups = new Map<string, RoomFieldConfigEntry[]>();
  sorted.forEach((field) => {
    const groupName = field.groupName || '其他';
    const current = groups.get(groupName) ?? [];
    current.push(field);
    groups.set(groupName, current);
  });
  return [...groups.entries()].map(([groupName, groupFields]) => ({ groupName, fields: groupFields }));
}

export function validateRoomRequiredFields(
  payload: Record<string, unknown>,
  fields: RoomFieldConfigEntry[],
): { fieldCode: string; displayName: string } | null {
  for (const field of [...fields].sort((a, b) => a.sortNo - b.sortNo)) {
    if (!field.required || !(field.fieldCode in payload)) continue;
    const value = payload[field.fieldCode];
    const missing = value === null
      || value === undefined
      || (typeof value === 'string' && value.trim() === '')
      || (Array.isArray(value) && value.length === 0);
    if (missing) return { fieldCode: field.fieldCode, displayName: field.displayName };
  }
  return null;
}

export function applyRoomFieldDefaults<T extends Record<string, unknown>>(
  payload: T,
  fields: RoomFieldConfigEntry[],
): T {
  const result: Record<string, unknown> = { ...payload };
  fields.forEach((field) => {
    if (field.defaultValue === null || !(field.fieldCode in result)) return;
    const current = result[field.fieldCode];
    const empty = current === '' || current === null || current === undefined
      || (field.dataType === 'integer' && current === 0)
      || (field.dataType === 'boolean' && current === false);
    if (!empty) return;
    if (field.dataType === 'integer') {
      result[field.fieldCode] = Number(field.defaultValue);
    } else if (field.dataType === 'boolean') {
      result[field.fieldCode] = ['1', 'true'].includes(field.defaultValue);
    } else {
      result[field.fieldCode] = field.defaultValue;
    }
  });
  return result as T;
}

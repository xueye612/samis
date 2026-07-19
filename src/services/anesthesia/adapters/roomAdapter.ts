import { pickField, pickString, unwrapListPayload } from '@/services/anesthesia/adapters/fieldUtils';

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

export interface RoomCapabilityItem {
  capabilityType: string;
  capabilityCode: string;
  capabilityName: string | null;
}

export interface RoomEquipmentSummary {
  deviceId: number;
  deviceCode: string;
  deviceName: string;
  deviceType: string;
  status: string;
  currentRoomId: number | null;
  version: number;
  bindingId: number | null;
}

export interface RoomConfiguration {
  roomId: number;
  roomCode: string;
  roomName: string;
  shortName: string | null;
  roomType: string | null;
  roomTypeName: string | null;
  roomGroupId: string | null;
  roomGroupName: string | null;
  campus: string | null;
  floor: string | null;
  location: string | null;
  cleanLevel: string | null;
  emergencyCapable: boolean;
  negativePressure: boolean;
  hybridRoom: boolean;
  defaultAnesthesiaMachine: string | null;
  defaultMonitor: string | null;
  defaultWorkstation: string | null;
  stationCapacity: number;
  openTime: string | null;
  closeTime: string | null;
  schedulePreference: string | null;
  staffPreference: string | null;
  sortNo: number;
  status: string;
  statusReason: string | null;
  effectiveAt: string | null;
  pausedAt: string | null;
  disabledAt: string | null;
  version: number;
  remark: string | null;
  createdBy: string | null;
  createdAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  capabilities: RoomCapabilityItem[];
  equipment: RoomEquipmentSummary[];
}

export interface RoomStatusHistoryItem {
  id: number;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actor: string | null;
  version: number;
  occurredAt: string | null;
}

function nullableString(raw: unknown, keys: string[]): string | null {
  const value = pickField(raw, keys);
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function boolField(raw: unknown, keys: string[]): boolean {
  const value = pickField(raw, keys);
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;
  const num = Number(value);
  if (Number.isFinite(num)) return num !== 0;
  return false;
}

function intField(raw: unknown, keys: string[], fallback = 0): number {
  const value = pickField(raw, keys);
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

/** 丰富手术间映射：保留全部结构化字段、false/0/null 与整数版本；不以名称反造编码。 */
export function mapRoomConfiguration(raw: unknown): RoomConfiguration {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawCaps = pickField(record, ['capabilities']);
  const capabilities: RoomCapabilityItem[] = Array.isArray(rawCaps)
    ? rawCaps.map((c): RoomCapabilityItem => {
        const cap = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
        return {
          capabilityType: pickString(cap, ['capabilityType', 'capability_type'], ''),
          capabilityCode: pickString(cap, ['capabilityCode', 'capability_code'], ''),
          capabilityName: nullableString(cap, ['capabilityName', 'capability_name']),
        };
      }).filter((c) => c.capabilityType && c.capabilityCode)
    : [];
  const rawEquipment = pickField(record, ['equipment']);
  const equipment: RoomEquipmentSummary[] = Array.isArray(rawEquipment)
    ? rawEquipment.map((item): RoomEquipmentSummary => {
        const device = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const currentRoomId = pickField(device, ['currentRoomId', 'current_room_id']);
        const bindingId = pickField(device, ['bindingId', 'binding_id']);
        return {
          deviceId: intField(device, ['deviceId', 'device_id'], 0),
          deviceCode: pickString(device, ['deviceCode', 'device_code'], ''),
          deviceName: pickString(device, ['deviceName', 'device_name'], ''),
          deviceType: pickString(device, ['deviceType', 'device_type'], ''),
          status: pickString(device, ['status'], ''),
          currentRoomId: currentRoomId === null || currentRoomId === undefined || currentRoomId === '' ? null : Number(currentRoomId),
          version: intField(device, ['version'], 0),
          bindingId: bindingId === null || bindingId === undefined || bindingId === '' ? null : Number(bindingId),
        };
      }).filter((item) => item.deviceId > 0 && item.deviceCode)
    : [];

  return {
    roomId: intField(record, ['roomId', 'OPERATION_ROOM_ID'], 0),
    roomCode: pickString(record, ['roomCode', 'OPERATION_ROOM_CODE'], ''),
    roomName: pickString(record, ['roomName', 'OPERATION_ROOM_NAME'], ''),
    shortName: nullableString(record, ['shortName', 'short_name']),
    roomType: nullableString(record, ['roomType', 'OPERATION_ROOM_TYPE']),
    roomTypeName: nullableString(record, ['roomTypeName', 'room_type_name', 'OPERATION_ROOM_TYPE_NAME']),
    roomGroupId: nullableString(record, ['roomGroupId', 'OPERATION_ROOM_GROUP']),
    roomGroupName: nullableString(record, ['roomGroupName', 'room_group_name']),
    campus: nullableString(record, ['campus']),
    floor: nullableString(record, ['floor']),
    location: nullableString(record, ['location']),
    cleanLevel: nullableString(record, ['cleanLevel', 'clean_level']),
    emergencyCapable: boolField(record, ['emergencyCapable', 'emergency_capable']),
    negativePressure: boolField(record, ['negativePressure', 'negative_pressure']),
    hybridRoom: boolField(record, ['hybridRoom', 'hybrid_room']),
    defaultAnesthesiaMachine: nullableString(record, ['defaultAnesthesiaMachine', 'default_anesthesia_machine']),
    defaultMonitor: nullableString(record, ['defaultMonitor', 'default_monitor']),
    defaultWorkstation: nullableString(record, ['defaultWorkstation', 'default_workstation']),
    stationCapacity: intField(record, ['stationCapacity', 'station_capacity'], 0),
    openTime: nullableString(record, ['openTime', 'open_time']),
    closeTime: nullableString(record, ['closeTime', 'close_time']),
    schedulePreference: nullableString(record, ['schedulePreference', 'schedule_preference']),
    staffPreference: nullableString(record, ['staffPreference', 'staff_preference']),
    sortNo: intField(record, ['sortNo', 'sort_no'], 0),
    status: pickString(record, ['status'], ''),
    statusReason: nullableString(record, ['statusReason', 'status_reason']),
    effectiveAt: nullableString(record, ['effectiveAt', 'effective_at']),
    pausedAt: nullableString(record, ['pausedAt', 'paused_at']),
    disabledAt: nullableString(record, ['disabledAt', 'disabled_at']),
    version: intField(record, ['version'], 0),
    remark: nullableString(record, ['remark']),
    createdBy: nullableString(record, ['createdBy', 'created_by']),
    createdAt: nullableString(record, ['createdAt', 'created_at']),
    updatedBy: nullableString(record, ['updatedBy', 'updated_by']),
    updatedAt: nullableString(record, ['updatedAt', 'updated_at']),
    capabilities,
    equipment,
  };
}

export function mapRoomConfigurationList(data: unknown): RoomConfiguration[] {
  return unwrapListPayload(data).map(mapRoomConfiguration);
}

export function mapRoomHistory(data: unknown): RoomStatusHistoryItem[] {
  return unwrapListPayload(data).map((raw) => {
    const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      id: intField(record, ['id'], 0),
      fromStatus: nullableString(record, ['fromStatus', 'from_status']),
      toStatus: pickString(record, ['toStatus', 'to_status'], ''),
      reason: nullableString(record, ['reason']),
      actor: nullableString(record, ['actor']),
      version: intField(record, ['version'], 0),
      occurredAt: nullableString(record, ['occurredAt', 'occurred_at']),
    };
  });
}

export function mapRoomItem(raw: unknown): RoomCatalogItem {
  // 优先稳定业务编码 roomCode/OPERATION_ROOM_CODE；不得用数字 roomId 替代，也不以名称反造编码。
  const roomCode = pickString(raw, ['roomCode', 'OPERATION_ROOM_CODE'], '');
  const roomName = pickString(raw, ['roomName', 'OPERATION_ROOM_NAME', 'ROOMNAME', 'name', 'room'], roomCode);
  return {
    roomId: roomCode,
    roomName: roomName || roomCode,
    roomGroup: pickString(raw, ['roomGroupName', 'OPERATION_ROOM_GROUP_NAME', 'roomGroup', 'room_group', 'groupName']),
    roomGroupId: pickString(raw, ['roomGroupId', 'OPERATION_ROOM_GROUP', 'room_group_id', 'groupId']),
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

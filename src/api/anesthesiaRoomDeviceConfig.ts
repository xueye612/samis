import { normalizeSamisPath, samisHttpFetch } from '@/api/samisHttpClient';
import { samisRequest } from '@/api/samisClient';
import { useRoomDeviceMock } from '@/config/apiFlags';

/**
 * SAMIS 手术间设备采集配置契约（后端 /anesthesiaDevice/roomDevice*）。
 *
 * 所有权边界：手术间-设备关联、主/备角色、centralDeviceNo 全部归属 SAMIS；
 * deviceCode / deviceModel 只读快照自 HULI，前端不得提供修改 HULI 设备基础信息的入口。
 */

/**
 * 房间设备配置请求：默认直连真实后端（读取 HULI operation_room / physical_equipment），
 * 不受 anesthesiaDevice 模块级 mock 开关影响。仅当显式开启
 * VITE_ROOM_DEVICE_MOCK_ENABLED 时才走 mock，避免页面静默回退到内置 1/2/3 号 mock 房间。
 */
async function roomDeviceRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (useRoomDeviceMock()) {
    return samisRequest(path, init, { forceMock: true });
  }
  return samisHttpFetch<T>(normalizeSamisPath(path), init);
}

export interface RoomDeviceConfig {
  configId: number;
  roomId: number;
  roomCode: string;
  roomName: string;
  sourceDeviceId: number;
  deviceCode: string;
  deviceModel: string;
  deviceName: string | null;
  deviceType: string;
  deviceRole: 'primary' | 'secondary';
  centralDeviceNo: string;
  enabled: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  changeReason: string | null;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RoomDeviceTypeConfig {
  primaryDevice: RoomDeviceConfig | null;
  secondaryDevices: RoomDeviceConfig[];
  configStatus: 'configured' | 'unconfigured';
}

export interface RoomDeviceConfigListItem {
  roomId: number;
  roomCode: string;
  roomName: string;
  hasPrimaryVentilator: boolean;
  configStatus: 'configured' | 'unconfigured' | 'conflict';
  conflictCount: number;
  /** 按设备类型分组的配置（前端据此展示监护仪/呼吸机独立区域）。 */
  deviceConfigs: Record<string, RoomDeviceTypeConfig>;
  /** 向后兼容。 */
  primaryDevice: RoomDeviceConfig | null;
  secondaryDevices: RoomDeviceConfig[];
  anomalies: string[];
  lastChangedAt: string | null;
}

/** HULI 只读设备候选（编号/型号只读，不可在此修改）。 */
export interface HuliDeviceCandidate {
  deviceId: number;
  deviceCode: string;
  deviceModel: string;
  deviceName: string;
  huliDeviceType: string;
  status: string;
  enabled: boolean;
  readOnly: true;
  sourceSystem: 'HULI';
  occupied: boolean;
  configuredRoomName: string | null;
  selectable: boolean;
  disabledReason: string | null;
}

export interface RoomDeviceOption {
  roomId: number;
  roomCode: string;
  roomName: string;
}

export interface RoomDeviceOptionsResponse {
  rooms: RoomDeviceOption[];
  deviceTypes: string[];
  deviceCandidates: HuliDeviceCandidate[];
  deviceCandidatesTotal: number;
}

export interface SaveRoomDeviceConfigPayload {
  roomId: number;
  sourceDeviceId: number;
  deviceType: string;
  deviceRole: 'primary' | 'secondary';
  centralDeviceNo?: string;
  reason: string;
}

export const anesthesiaRoomDeviceConfigApi = {
  list(): Promise<{ list: RoomDeviceConfigListItem[]; total: number }> {
    return roomDeviceRequest(`/anesthesiaDevice/roomDeviceConfigList`);
  },
  options(params?: { keyword?: string; deviceStatus?: string; page?: number; pageSize?: number }): Promise<RoomDeviceOptionsResponse> {
    const query = new URLSearchParams();
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.deviceStatus) query.set('deviceStatus', params.deviceStatus);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return roomDeviceRequest(`/anesthesiaDevice/roomDeviceOptions${qs ? `?${qs}` : ''}`);
  },
  save(body: SaveRoomDeviceConfigPayload): Promise<RoomDeviceConfig> {
    return roomDeviceRequest(`/anesthesiaDevice/saveRoomDeviceConfig`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  remove(body: { configId: number; reason: string }): Promise<{ configId: number; enabled: boolean; effectiveTo: string; idempotent: boolean }> {
    return roomDeviceRequest(`/anesthesiaDevice/removeRoomDeviceConfig`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  history(params: { roomId?: number; sourceDeviceId?: number; deviceType?: string; page?: number; pageSize?: number }): Promise<{ list: RoomDeviceConfig[]; total: number }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
    });
    const qs = query.toString();
    return roomDeviceRequest(`/anesthesiaDevice/roomDeviceConfigHistory${qs ? `?${qs}` : ''}`);
  },
  /** 正式落点查询：普通5分钟(normal)/抢救1分钟(rescue)。写正式生命体征，同桶幂等，手工点优先。 */
  queryRecordPoint(params: { operationId: string; targetTime: string; mode?: 'normal' | 'rescue' }): Promise<{
    operationId: string; bucketTime: string; mode: string; deviceCode: string;
    actualObservedAt: string; source: string; metrics: Record<string, number>; skipped: string;
  }> {
    const q = new URLSearchParams({ operationId: params.operationId, targetTime: params.targetTime, mode: params.mode ?? 'normal' });
    return roomDeviceRequest(`/anesthesiaDevice/queryRecordPoint?${q.toString()}`);
  },
  /** 手工指定时间查询：只查询不保存。 */
  queryManualPoint(params: { operationId: string; targetTime: string; deviceType?: string }): Promise<{
    requestedTime: string; actualObservedAt: string; deviceCode: string; deviceType: string; source: string; metrics: Record<string, number>;
  }> {
    const q = new URLSearchParams({ operationId: params.operationId, targetTime: params.targetTime });
    if (params.deviceType) q.set('deviceType', params.deviceType);
    return roomDeviceRequest(`/anesthesiaDevice/queryManualPoint?${q.toString()}`);
  },
  /** 确认保存手工查询点（source=device_manual），后续自动点不覆盖。 */
  confirmManualPoint(body: { operationId: string; targetTime: string; operator?: string; reason?: string; deviceType?: string }): Promise<{ requestedTime: string; actualObservedAt: string; source: string; saved: boolean }> {
    return roomDeviceRequest(`/anesthesiaDevice/confirmManualPoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  /** 手术间设备联通测试（不依赖 operationId、不创建记录、不产生正式点）。 */
  testRoomConnection(roomId: number): Promise<{
    roomId: number; roomCode: string; roomName: string; overallStatus: string; testedAt: string;
    devices: Array<{
      deviceType: string; deviceCode: string; deviceModel: string; configured: boolean;
      reachable: boolean; latestObservedAt: string | null; dataAgeSeconds: number | null;
      source: string | null; qualityStatus: string | null; sample: Record<string, number>;
      status: string; errorCode: string | null; errorMessage: string | null;
    }>;
  }> {
    return roomDeviceRequest(`/anesthesiaDevice/testRoomConnection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    });
  },
  /** 统一采集状态（后端为唯一真值：顶部与设备区域共用）。 */
  collectionStatus(operationId: string): Promise<{
    operationId: string; collectionStatus: string; message: string; recordStatus: string | null;
    deviceCode: string | null; latestObservedAt: string | null; source: string | null; dataAgeSeconds: number | null;
  }> {
    return roomDeviceRequest(`/anesthesiaDevice/collectionStatus?operationId=${encodeURIComponent(operationId)}`);
  },
};

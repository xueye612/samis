import { samisRequest } from '@/api/samisClient';

/**
 * SAMIS 手术间设备采集配置契约（后端 /anesthesiaDevice/roomDevice*）。
 *
 * 所有权边界：手术间-设备关联、主/备角色、centralDeviceNo 全部归属 SAMIS；
 * deviceCode / deviceModel 只读快照自 HULI，前端不得提供修改 HULI 设备基础信息的入口。
 */

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
    return samisRequest(`/anesthesiaDevice/roomDeviceConfigList`);
  },
  options(params?: { keyword?: string; deviceStatus?: string; page?: number; pageSize?: number }): Promise<RoomDeviceOptionsResponse> {
    const query = new URLSearchParams();
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.deviceStatus) query.set('deviceStatus', params.deviceStatus);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    const qs = query.toString();
    return samisRequest(`/anesthesiaDevice/roomDeviceOptions${qs ? `?${qs}` : ''}`);
  },
  save(body: SaveRoomDeviceConfigPayload): Promise<RoomDeviceConfig> {
    return samisRequest(`/anesthesiaDevice/saveRoomDeviceConfig`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  remove(body: { configId: number; reason: string }): Promise<{ configId: number; enabled: boolean; effectiveTo: string; idempotent: boolean }> {
    return samisRequest(`/anesthesiaDevice/removeRoomDeviceConfig`, {
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
    return samisRequest(`/anesthesiaDevice/roomDeviceConfigHistory${qs ? `?${qs}` : ''}`);
  },
};

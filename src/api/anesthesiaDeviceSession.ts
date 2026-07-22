import { samisRequest } from '@/api/samisClient';

/**
 * 麻醉病例设备采集会话统一契约（后端 GET /anesthesiaDevice/getLatestDeviceData）。
 *
 * 后端内部经 ensureActiveBinding 复用/兜底创建采集会话，归属由 bindingId 决定，
 * 不在每次请求按当前房间重新选设备。轮询携带 nextCursor 取增量 items。
 */
export interface DeviceSessionBinding {
  bindingId: string;
  bindingMode: string;
  status: string;
  effectiveFrom: string | null;
  roomId: number | null;
  roomCode: string | null;
  roomName: string | null;
  deviceCode: string;
  deviceName: string | null;
  deviceType: string;
}

export interface DeviceMetric {
  code: string;
  value: number;
  unit: string;
}

export interface DeviceSample {
  messageId: string;
  observedAt: string;
  receivedAt: string;
  minuteBucketAt: string;
  fiveMinuteBucketAt: string;
  metrics: DeviceMetric[];
  metadata: { preview?: boolean; ventMode?: string; [key: string]: unknown };
}

export interface DeviceSessionResponse {
  operationId: string;
  binding: DeviceSessionBinding;
  device: { source: string; status: string };
  latest: DeviceSample | null;
  items: DeviceSample[];
  nextCursor: string | null;
  hasMore: boolean;
  roomChanged: boolean;
  bindingRoomCode: string | null;
  bindingRoomName: string | null;
  currentRoomCode: string | null;
  currentRoomName: string | null;
  serverTime: string;
}

export interface DeviceSessionQuery {
  operationId: string;
  cursor?: string | null;
  limit?: number;
}

export const anesthesiaDeviceSessionApi = {
  getLatestDeviceData(params: DeviceSessionQuery): Promise<DeviceSessionResponse> {
    const query = new URLSearchParams({ operationId: params.operationId });
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.limit) query.set('limit', String(params.limit));
    return samisRequest<DeviceSessionResponse>(
      `/anesthesiaDevice/getLatestDeviceData?${query.toString()}`,
    );
  },
  transfer(body: { operationId: string; targetRoomId: number; reason: string }) {
    return samisRequest<DeviceSessionBinding>(`/anesthesiaDevice/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
};

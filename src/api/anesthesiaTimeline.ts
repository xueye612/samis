import { samisRequest } from '@/api/samisClient';

/**
 * 关键时间后端闭环契约。
 * 审计正式落 anes_business_audit_log + anes_timeline_event，前端 IndexedDB 仅作缓存。
 */

export interface TimelineNodeState {
  nodeCode: string;
  nodeName: string;
  order: number;
  eventTime: string | null;
  originalEventTime: string | null;
  source: string | null;
  isHuliSource: boolean;
  recorded: boolean;
}

export interface SaveTimelineNodeResponse {
  operationId: string;
  syncVersion: number;
  nodeCode: string;
  changed: boolean;
  eventTime: string | null;
  originalEventTime: string | null;
  source: string | null;
  nodes: TimelineNodeState[];
}

export interface SaveTimelineNodePayload {
  operationId: string;
  nodeCode: string;
  nodeName?: string;
  newTime: string | null;
  reason?: string;
  timelineOrderOverride?: boolean;
  source?: string;
  expectedVersion: number;
}

export interface ServerTimeResponse {
  serverTime: string;
  timezone: string;
}

export const anesthesiaTimelineApi = {
  saveTimelineNode(body: SaveTimelineNodePayload): Promise<SaveTimelineNodeResponse> {
    return samisRequest(`/anesthesiaRecord/saveTimelineNode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  getTimelineNodes(operationId: string): Promise<{ nodes: TimelineNodeState[] }> {
    const query = new URLSearchParams({ operationId });
    return samisRequest(`/anesthesiaRecord/getTimelineNodes?${query.toString()}`);
  },
  getServerNow(): Promise<ServerTimeResponse> {
    return samisRequest(`/system/now`);
  },
};

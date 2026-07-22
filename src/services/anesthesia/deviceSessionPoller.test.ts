import { describe, expect, it, vi } from 'vitest';
import {
  applySessionResponse,
  createDeviceSessionPoller,
  emptyDeviceSessionState,
  mergeItems,
  type DeviceSessionState,
} from '@/services/anesthesia/deviceSessionPoller';
import type { DeviceSessionResponse, DeviceSample } from '@/api/anesthesiaDeviceSession';

function sample(messageId: string, observedAt: string): DeviceSample {
  return {
    messageId,
    observedAt,
    receivedAt: observedAt,
    minuteBucketAt: observedAt,
    fiveMinuteBucketAt: observedAt,
    metrics: [{ code: 'Vt', value: 450, unit: 'mL' }],
    metadata: { preview: true, ventMode: 'VCV' },
  };
}

function response(partial: Partial<DeviceSessionResponse>): DeviceSessionResponse {
  return {
    operationId: 'OP-1',
    binding: {
      bindingId: 'B-1', bindingMode: 'auto', status: 'active', effectiveFrom: '2026-07-22T14:32:16+08:00',
      roomId: 3, roomCode: 'OR-03', roomName: '3号手术间', deviceCode: 'VENT-OR-03', deviceName: '3号呼吸机', deviceType: 'ventilator',
    },
    device: { source: 'preview', status: 'preview' },
    latest: sample('preview:VENT-OR-03:1', '2026-07-22T14:32:16+08:00'),
    items: [],
    nextCursor: '2026-07-22T14:32:16+08:00',
    hasMore: false,
    roomChanged: false,
    bindingRoomCode: 'OR-03',
    bindingRoomName: '3号手术间',
    currentRoomCode: null,
    currentRoomName: null,
    serverTime: '2026-07-22T14:32:17+08:00',
    ...partial,
  };
}

describe('deviceSessionPoller.mergeItems', () => {
  it('dedups by messageId and preserves order', () => {
    const a = [sample('m1', 't1'), sample('m2', 't2')];
    const b = [sample('m2', 't2'), sample('m3', 't3')];
    expect(mergeItems(a, b).map((x) => x.messageId)).toEqual(['m1', 'm2', 'm3']);
  });
  it('does not append duplicate messageId already present', () => {
    expect(mergeItems([sample('m1', 't1')], [sample('m1', 't1')])).toHaveLength(1);
  });
});

describe('deviceSessionPoller.applySessionResponse', () => {
  it('maps latest and incremental items without duplicating messageId', () => {
    let state = emptyDeviceSessionState('OP-1');
    state = applySessionResponse(state, response({ latest: sample('m1', 't1'), items: [], nextCursor: 't1' }), 'p1');
    expect(state.latest?.messageId).toBe('m1');
    expect(state.items).toEqual([]);
    state = applySessionResponse(state, response({
      latest: sample('m3', 't3'),
      items: [sample('m2', 't2')],
      nextCursor: 't3',
    }), 'p2');
    expect(state.items.map((x) => x.messageId)).toEqual(['m2']);
    expect(state.latest?.messageId).toBe('m3');
    // 再次返回相同 m2 不重复追加
    state = applySessionResponse(state, response({ latest: sample('m3', 't3'), items: [sample('m2', 't2')], nextCursor: 't3' }), 'p3');
    expect(state.items.map((x) => x.messageId)).toEqual(['m2']);
  });

  it('surfaces roomChanged without switching device', () => {
    const state = applySessionResponse(
      emptyDeviceSessionState('OP-1'),
      response({ roomChanged: true, bindingRoomCode: 'OR-03', currentRoomCode: 'OR-05', currentRoomName: '5号手术间' }),
      'p1',
    );
    expect(state.roomChanged).toBe(true);
    expect(state.binding?.deviceCode).toBe('VENT-OR-03'); // 仍为原绑定设备
    expect(state.currentRoomCode).toBe('OR-05');
  });
});

describe('deviceSessionPoller.createDeviceSessionPoller', () => {
  it('starts, carries nextCursor, and stops polling on terminal error (case ended)', async () => {
    const calls: Array<string | null> = [];
    const load = vi.fn(async (params: { operationId: string; cursor: string | null }) => {
      calls.push(params.cursor);
      // 第一次成功，第二次返回终态错误（病例结束）
      if (calls.length === 1) return response({ nextCursor: 'cursor-1' });
      const err = Object.assign(new Error('病例已结束'), { code: 4092 });
      throw err;
    });
    const states: DeviceSessionState[] = [];
    vi.useFakeTimers();
    const poller = createDeviceSessionPoller({
      operationId: 'OP-1', intervalMs: 1000, load, now: () => 0, onState: (s) => states.push({ ...s }),
    });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    // 第一次成功
    const afterFirst = states[states.length - 1];
    expect(afterFirst?.nextCursor).toBe('cursor-1');
    expect(afterFirst?.ended).toBe(false);
    // 推进到下一次轮询
    await vi.advanceTimersByTimeAsync(1500);
    await Promise.resolve();
    const last = states[states.length - 1]!;
    expect(last.ended).toBe(true);
    expect(last.error).toContain('病例已结束');
    poller.stop();
    vi.useRealTimers();
  });

  it('does not re-enter while a request is in flight', async () => {
    type Resolver = (v: DeviceSessionResponse) => void;
    const holder: { r: Resolver | null } = { r: null };
    const load = vi.fn(() => new Promise<DeviceSessionResponse>((res) => { holder.r = res; }));
    const poller = createDeviceSessionPoller({ operationId: 'OP-1', load, now: () => 0, onState: () => {} });
    poller.start();
    const p1 = poller.refresh();
    const p2 = poller.refresh(); // 并发重入应复用同一 inFlight
    expect(load).toHaveBeenCalledTimes(1);
    expect(p1).toBe(p2);
    if (holder.r) holder.r(response({}));
    await p1;
    poller.stop();
  });

  it('switching case clears old cursor/items (restart resets state)', () => {
    let state = applySessionResponse(emptyDeviceSessionState('OP-1'), response({ items: [sample('m2', 't2')], nextCursor: 'c1' }), 'p');
    // 模拟 restartDeviceSessionPolling 重置
    state = emptyDeviceSessionState('OP-2');
    expect(state.nextCursor).toBeNull();
    expect(state.items).toEqual([]);
    expect(state.operationId).toBe('OP-2');
  });
});

describe('deviceSessionPoller.waitingForPatientEntry', () => {
  function waitingResponse(): DeviceSessionResponse {
    return {
      operationId: 'OP-1',
      binding: null,
      device: null,
      latest: null,
      items: [],
      nextCursor: null,
      hasMore: false,
      roomChanged: false,
      bindingRoomCode: null,
      bindingRoomName: null,
      currentRoomCode: null,
      currentRoomName: null,
      waitingForPatientEntry: true,
      status: 'waiting_for_patient_entry',
      message: '患者尚未入室，入室后将自动关联设备',
      serverTime: '2026-07-22T14:32:17+08:00',
    };
  }

  it('treats waiting response as a normal state (not error, not ended)', () => {
    const state = applySessionResponse(emptyDeviceSessionState('OP-1'), waitingResponse(), 'p1');
    expect(state.waitingForPatientEntry).toBe(true);
    expect(state.binding).toBeNull();
    expect(state.latest).toBeNull();
    expect(state.items).toEqual([]);
    expect(state.error).toBeNull();
    expect(state.ended).toBe(false);
  });

  it('does not show device real-time values while waiting', () => {
    const state = applySessionResponse(emptyDeviceSessionState('OP-1'), waitingResponse(), 'p1');
    expect(state.source).toBe('');
    expect(state.status).toBe('waiting_for_patient_entry');
  });

  it('switches back to preview state once an active binding arrives (no poller rebuild)', () => {
    // 先等待，再返回活动 binding（同 poller 持续轮询）
    let state = applySessionResponse(emptyDeviceSessionState('OP-1'), waitingResponse(), 'p1');
    expect(state.waitingForPatientEntry).toBe(true);
    state = applySessionResponse(state, response({}), 'p2');
    expect(state.waitingForPatientEntry).toBe(false);
    expect(state.binding?.bindingId).toBe('B-1');
    expect(state.latest).not.toBeNull();
  });

  it('keeps polling on waiting (success response does not stop the poller)', async () => {
    const states: DeviceSessionState[] = [];
    let call = 0;
    const load = vi.fn(async () => {
      call += 1;
      // 两次等待后第三次返回绑定
      return call <= 2 ? waitingResponse() : response({});
    });
    vi.useFakeTimers();
    const poller = createDeviceSessionPoller({
      operationId: 'OP-1', intervalMs: 1000, load, now: () => 0, onState: (s) => states.push({ ...s }),
    });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    expect(states[states.length - 1].waitingForPatientEntry).toBe(true);
    expect(states[states.length - 1].ended).toBe(false); // 未停止
    await vi.advanceTimersByTimeAsync(2500); // 触发后续轮询
    await Promise.resolve();
    const last = states[states.length - 1];
    expect(last.waitingForPatientEntry).toBe(false);
    expect(last.binding?.bindingId).toBe('B-1');
    poller.stop();
    vi.useRealTimers();
  });
});

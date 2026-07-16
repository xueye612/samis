import { describe, expect, it, vi } from 'vitest';
import type { LatestDeviceDataApi } from '@/api/anesthesiaSync';
import {
  createRealtimeDevicePoller,
  normalizeLatestDeviceData,
  resolveDeviceFreshness,
  type RealtimeDeviceState,
} from '@/services/anesthesia/realtimeDeviceData';

describe('realtime device data', () => {
  it('normalizes monitor and ventilator numeric strings without inventing missing values', () => {
    const result = normalizeLatestDeviceData({
      monitor: {
        localId: 'MON-1', collectTime: '2026-07-16 12:00:00', deviceId: 'M-1',
        hr: '78', sbp: 120, dbp: '70', mapValue: null, spo2: '99', temperature: '', respiration: 16,
        bis: '52', etco2: '36',
      },
      ventilator: {
        localId: 'VENT-1', collectTime: '2026-07-16 12:00:01', deviceId: 'V-1',
        ventMode: 'VCV', tidalVolume: '480', respiratoryRate: '14', fio2: '45', peep: '5',
        peakPressure: '19', plateauPressure: null, minuteVolume: '6.7', airwayPressure: '17', etco2: '35',
      },
    });

    expect(result.monitor).toEqual(expect.objectContaining({
      hr: 78, sbp: 120, dbp: 70, mapValue: null, spo2: 99, temperature: null, respiration: 16, bis: 52, etco2: 36,
    }));
    expect(result.ventilator).toEqual(expect.objectContaining({
      ventMode: 'VCV', tidalVolume: 480, respiratoryRate: 14, fio2: 45, peep: 5,
      peakPressure: 19, plateauPressure: null, minuteVolume: 6.7, airwayPressure: 17, etco2: 35,
    }));
  });

  it('classifies freshness using the newest real collection timestamp', () => {
    const now = Date.parse('2026-07-16T12:00:30+08:00');
    expect(resolveDeviceFreshness({ monitor: null, ventilator: null }, now)).toBe('empty');
    expect(resolveDeviceFreshness(normalizeLatestDeviceData({ monitor: { collectTime: '2026-07-16 12:00:20' }, ventilator: null }), now)).toBe('live');
    expect(resolveDeviceFreshness(normalizeLatestDeviceData({ monitor: { collectTime: '2026-07-16 11:59:50' }, ventilator: null }), now)).toBe('delayed');
    expect(resolveDeviceFreshness(normalizeLatestDeviceData({ monitor: { collectTime: '2026-07-16 11:58:00' }, ventilator: null }), now)).toBe('offline');
  });

  it('prevents overlapping requests and keeps the last good snapshot when a later poll fails', async () => {
    let resolveFirst!: (value: LatestDeviceDataApi) => void;
    const first = new Promise<LatestDeviceDataApi>((resolve) => { resolveFirst = resolve; });
    const load = vi.fn()
      .mockReturnValueOnce(first)
      .mockRejectedValueOnce(new Error('network down'));
    const states: RealtimeDeviceState[] = [];
    const poller = createRealtimeDevicePoller({
      operationId: 'OP-1',
      intervalMs: 60_000,
      load,
      now: () => Date.parse('2026-07-16T12:00:05+08:00'),
      onState: (state) => states.push(state),
    });

    const firstRefresh = poller.refresh();
    const duplicateRefresh = poller.refresh();
    expect(load).toHaveBeenCalledTimes(1);
    resolveFirst({ monitor: { localId: 'MON-1', collectTime: '2026-07-16 12:00:00', hr: 80 }, ventilator: null });
    await Promise.all([firstRefresh, duplicateRefresh]);
    await poller.refresh();

    expect(load).toHaveBeenCalledTimes(2);
    expect(states[states.length - 1]).toEqual(expect.objectContaining({
      error: 'network down',
      data: expect.objectContaining({ monitor: expect.objectContaining({ localId: 'MON-1', hr: 80 }) }),
    }));
    poller.stop();
  });

  it('ignores a late response after the case-scoped poller is stopped', async () => {
    let resolveLoad!: (value: LatestDeviceDataApi) => void;
    const load = vi.fn(() => new Promise<LatestDeviceDataApi>((resolve) => { resolveLoad = resolve; }));
    const states: RealtimeDeviceState[] = [];
    const poller = createRealtimeDevicePoller({
      operationId: 'OP-OLD',
      load,
      onState: (state) => states.push(state),
    });
    const pending = poller.refresh();
    poller.stop();
    resolveLoad({ monitor: { localId: 'LATE', collectTime: '2026-07-16 12:00:00', hr: 77 }, ventilator: null });
    await pending;

    expect(states.some((state) => state.data.monitor?.localId === 'LATE')).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configApi } from '@/api/clinicalExtensions';
import {
  DEVICE_REALTIME_SOURCE_STORAGE_KEY,
  loadDeviceRealtimeSource,
  mapSimulatedDeviceRows,
  readCachedDeviceRealtimeSource,
  saveDeviceRealtimeSource,
  notifySimulatedDeviceDataCollected,
  subscribeSimulatedDeviceDataCollected,
  shouldAutoStartMonitorOnRecordStart,
} from './deviceRealtimeSource';

vi.mock('@/api/clinicalExtensions', () => ({
  configApi: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe('deviceRealtimeSource', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
      clear: () => storage.clear(),
    });
    vi.clearAllMocks();
  });

  it('以后台配置为准并缓存真实/模拟数据源', async () => {
    vi.mocked(configApi.get).mockResolvedValue({
      key: 'device_realtime_data_source', value: 'real', scope: 'global', source: 'database',
    });

    await expect(loadDeviceRealtimeSource()).resolves.toBe('real');
    expect(readCachedDeviceRealtimeSource()).toBe('real');
    expect(localStorage.getItem(DEVICE_REALTIME_SOURCE_STORAGE_KEY)).toBe('real');
  });

  it('后台暂不可用时使用最后一次后台缓存，无缓存则安全默认真实设备', async () => {
    vi.mocked(configApi.get).mockRejectedValue(new Error('offline'));
    await expect(loadDeviceRealtimeSource()).resolves.toBe('real');

    localStorage.setItem(DEVICE_REALTIME_SOURCE_STORAGE_KEY, 'simulation');
    await expect(loadDeviceRealtimeSource()).resolves.toBe('simulation');
  });

  it('保存时只接受受控值并写入后台', async () => {
    vi.mocked(configApi.set).mockResolvedValue({
      key: 'device_realtime_data_source', value: 'simulation', scope: 'global', source: 'database',
    });

    await expect(saveDeviceRealtimeSource('simulation')).resolves.toBe('simulation');
    expect(configApi.set).toHaveBeenCalledWith(
      'device_realtime_data_source',
      'simulation',
      'global',
      expect.stringContaining('麻醉记录单'),
    );
  });

  it('把本地模拟原始行映射成实时设备接口契约', () => {
    const data = mapSimulatedDeviceRows({
      local_id: 'm-1', record_local_id: 'OP-1', operation_id: 'OP-1', collect_time: '2026-07-16 15:30:00',
      hr: 80, pulse: 81, sbp: 120, dbp: 70, map_value: 87, spo2: 99, temperature: 36.5,
      respiration: 14, bis: 48, etco2: 36, source_device: 'monitor_mock', device_id: 'monitor_mock_01',
      sync_status: 'local_only', sync_version: 1, created_at: '2026-07-16 15:30:00', updated_at: '2026-07-16 15:30:00',
    }, {
      local_id: 'v-1', record_local_id: 'OP-1', operation_id: 'OP-1', collect_time: '2026-07-16 15:30:01',
      vent_mode: 'VCV', tidal_volume: 480, respiratory_rate: 12, fio2: 50, peep: 5,
      peak_pressure: 18, plateau_pressure: 14, minute_volume: 5.8, etco2: 35, airway_pressure: 16,
      source_device: 'ventilator_mock', device_id: 'ventilator_mock_01', sync_status: 'local_only', sync_version: 1,
      created_at: '2026-07-16 15:30:01', updated_at: '2026-07-16 15:30:01',
    });

    expect(data.monitor).toMatchObject({ operationId: 'OP-1', hr: 80, mapValue: 87, etco2: 36 });
    expect(data.ventilator).toMatchObject({ operationId: 'OP-1', ventMode: 'VCV', tidalVolume: 480, airwayPressure: 16 });
  });

  it('模拟原始帧落库后通知当前记录单立即刷新', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSimulatedDeviceDataCollected(listener);
    notifySimulatedDeviceDataCollected('OP-1');
    unsubscribe();
    notifySimulatedDeviceDataCollected('OP-2');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('OP-1');
  });

  it('只有后台明确配置模拟数据时启动记录才自动开启监护仪', () => {
    expect(shouldAutoStartMonitorOnRecordStart('simulation', true)).toBe(true);
    expect(shouldAutoStartMonitorOnRecordStart('real', true)).toBe(false);
    expect(shouldAutoStartMonitorOnRecordStart('simulation', false)).toBe(false);
  });
});

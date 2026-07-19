import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clampDeviceRawIntervalSeconds,
  readDeviceRawIntervalSeconds,
  resolveDeviceRawIntervalMs,
  writeDeviceRawIntervalSeconds,
} from '@/services/anesthesia/deviceSimulationMode';

describe('deviceSimulationMode raw collection interval', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    localStorage.clear();
  });

  it('stores a configurable 2-30 second raw interval while rescue stays at 2 seconds', () => {
    expect(clampDeviceRawIntervalSeconds(undefined)).toBe(5);
    expect(readDeviceRawIntervalSeconds()).toBe(5);
    expect(clampDeviceRawIntervalSeconds(1)).toBe(2);
    expect(clampDeviceRawIntervalSeconds(60)).toBe(30);
    writeDeviceRawIntervalSeconds(10);
    expect(readDeviceRawIntervalSeconds()).toBe(10);
    expect(resolveDeviceRawIntervalMs('normal')).toBe(10_000);
    expect(resolveDeviceRawIntervalMs('rescue')).toBe(2_000);
  });
});

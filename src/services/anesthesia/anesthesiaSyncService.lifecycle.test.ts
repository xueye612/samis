import { afterEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  startAnesthesiaSyncService,
  stopAnesthesiaSyncService,
  triggerAnesthesiaSyncAfterChange,
} from '@/services/anesthesia/anesthesiaSyncService';

describe('anesthesiaSyncService lifecycle', () => {
  afterEach(() => {
    stopAnesthesiaSyncService();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('clears timers and removes the same online and offline listeners when stopped', () => {
    vi.useFakeTimers();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('window', { addEventListener, removeEventListener });
    vi.stubGlobal('navigator', { onLine: true });

    startAnesthesiaSyncService();
    triggerAnesthesiaSyncAfterChange('medication');
    triggerAnesthesiaSyncAfterChange('vital_sign');
    triggerAnesthesiaSyncAfterChange('monitor_raw');
    const online = addEventListener.mock.calls.find(([name]) => name === 'online')?.[1];
    const offline = addEventListener.mock.calls.find(([name]) => name === 'offline')?.[1];
    expect(vi.getTimerCount()).toBe(4);
    stopAnesthesiaSyncService();

    expect(vi.getTimerCount()).toBe(0);
    expect(online).toBeTypeOf('function');
    expect(offline).toBeTypeOf('function');
    expect(removeEventListener).toHaveBeenCalledWith('online', online);
    expect(removeEventListener).toHaveBeenCalledWith('offline', offline);
  });
});

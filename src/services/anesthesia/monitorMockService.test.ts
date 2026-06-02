import { describe, expect, it } from 'vitest';
import {
  clampMonitorDisplayIntervalMinutes,
  DEFAULT_MONITOR_DISPLAY_INTERVAL_MINUTES,
  RESCUE_MONITOR_DISPLAY_INTERVAL_MINUTES,
  resolveMonitorDisplayIntervalMinutes,
} from './monitorMockService';

describe('monitorMockService interval', () => {
  it('defaults to 5 minutes and clamps to 1-5', () => {
    expect(DEFAULT_MONITOR_DISPLAY_INTERVAL_MINUTES).toBe(5);
    expect(RESCUE_MONITOR_DISPLAY_INTERVAL_MINUTES).toBe(1);
    expect(clampMonitorDisplayIntervalMinutes(undefined)).toBe(5);
    expect(clampMonitorDisplayIntervalMinutes(0)).toBe(1);
    expect(clampMonitorDisplayIntervalMinutes(3.6)).toBe(4);
    expect(clampMonitorDisplayIntervalMinutes(9)).toBe(5);
  });

  it('uses 1 minute in rescue mode regardless of configured interval', () => {
    expect(resolveMonitorDisplayIntervalMinutes({ rescueMode: true, displayIntervalMinutes: 5 })).toBe(1);
    expect(resolveMonitorDisplayIntervalMinutes({ simulationMode: 'rescue', displayIntervalMinutes: 5 })).toBe(1);
    expect(resolveMonitorDisplayIntervalMinutes({ rescueMode: false, displayIntervalMinutes: 3 })).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import { buildBalanceSummary } from './anesthesiaRecordEngine';
import type { FluidRecord, OutputDetailRecord } from '@/types/anesthesia';

const fluid = (over: Partial<FluidRecord>): FluidRecord => ({
  id: Math.random().toString(36).slice(2),
  category: '晶体液',
  name: '乳酸钠林格',
  startTime: '2026-01-01T08:00:00.000Z',
  volume: 500,
  executor: '医生',
  ...over,
});

const output = (over: Partial<OutputDetailRecord>): OutputDetailRecord => ({
  id: Math.random().toString(36).slice(2),
  time: '2026-01-01T09:00:00.000Z',
  type: '尿量',
  volume: 200,
  ...over,
});

describe('void model — balance summary excludes voided records', () => {
  it('excludes voided fluids from input totals', () => {
    const summary = buildBalanceSummary({
      fluids: [
        fluid({ volume: 500 }),
        fluid({ volume: 1000, status: 'voided' }),
        fluid({ category: '血液制品', volume: 300 }),
      ],
      outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
      outputRecords: [],
    });
    expect(summary.crystalInput).toBe(500);
    expect(summary.bloodInput).toBe(300);
    expect(summary.totalInput).toBe(800);
  });

  it('excludes voided outputs from output totals', () => {
    const summary = buildBalanceSummary({
      fluids: [],
      outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
      outputRecords: [
        output({ type: '尿量', volume: 200 }),
        output({ type: '尿量', volume: 500, status: 'voided' }),
        output({ type: '出血量', volume: 100 }),
      ],
    });
    expect(summary.urine).toBe(200);
    expect(summary.bloodLoss).toBe(100);
    expect(summary.totalOutput).toBe(300);
  });

  it('treats active status the same as undefined status', () => {
    const summary = buildBalanceSummary({
      fluids: [fluid({ volume: 250, status: 'active' }), fluid({ volume: 250 })],
      outputs: { urine: 0, bloodLoss: 0, drainage: 0 },
      outputRecords: [],
    });
    expect(summary.crystalInput).toBe(500);
  });
});

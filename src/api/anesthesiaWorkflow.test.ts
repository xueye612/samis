import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ samisRequest: vi.fn() }));
vi.mock('@/api/samisClient', () => ({ samisRequest: mocks.samisRequest }));

import { anesthesiaHandoverApi, anesthesiaPlanApi } from '@/api/anesthesiaWorkflow';

function bodyOfCall(): URLSearchParams {
  const init = mocks.samisRequest.mock.calls[0][1] as RequestInit;
  return new URLSearchParams(String(init.body));
}

describe('anesthesia workflow api payloads', () => {
  beforeEach(() => {
    mocks.samisRequest.mockReset();
    mocks.samisRequest.mockResolvedValue({});
  });

  it('serializes structured anesthesia plan fields instead of dropping them', async () => {
    await anesthesiaPlanApi.saveDraft({
      operationId: 'OP-1',
      alternativeMethods: ['neuraxial'],
      airwayPlan: { strategy: 'endotracheal' },
      monitoringPlan: { items: ['ECG', 'SpO2'] },
      specialRisks: ['difficult_airway'],
    });

    const body = bodyOfCall();
    expect(JSON.parse(body.get('alternativeMethods') ?? '')).toEqual(['neuraxial']);
    expect(JSON.parse(body.get('airwayPlan') ?? '')).toEqual({ strategy: 'endotracheal' });
    expect(JSON.parse(body.get('monitoringPlan') ?? '')).toEqual({ items: ['ECG', 'SpO2'] });
    expect(JSON.parse(body.get('specialRisks') ?? '')).toEqual(['difficult_airway']);
  });

  it('serializes handover checks and pending tasks', async () => {
    await anesthesiaHandoverApi.saveDraft({
      operationId: 'OP-1',
      pendingTasks: ['复查血气'],
      checks: [{ itemCode: 'equipment', result: 'exception', remark: '已切换备用机' }],
    });

    const body = bodyOfCall();
    expect(JSON.parse(body.get('pendingTasks') ?? '')).toEqual(['复查血气']);
    expect(JSON.parse(body.get('checks') ?? '')).toEqual([
      { itemCode: 'equipment', result: 'exception', remark: '已切换备用机' },
    ]);
  });
});

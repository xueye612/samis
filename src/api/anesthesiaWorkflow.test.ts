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
      vascularAccessPlan: [{ site: '左手', type: 'PIV' }],
      fluidPlanDetail: [{ fluidCode: 'NS', volumeMl: 500 }],
      transfusionPlan: { required: false },
      backupPlan: { method: 'LMA' },
      riskResponsePlan: [{ risk: 'PONV', action: '预防' }],
    });

    const body = bodyOfCall();
    expect(JSON.parse(body.get('alternativeMethods') ?? '')).toEqual(['neuraxial']);
    expect(JSON.parse(body.get('airwayPlan') ?? '')).toEqual({ strategy: 'endotracheal' });
    expect(JSON.parse(body.get('monitoringPlan') ?? '')).toEqual({ items: ['ECG', 'SpO2'] });
    expect(JSON.parse(body.get('specialRisks') ?? '')).toEqual(['difficult_airway']);
    expect(JSON.parse(body.get('vascularAccessPlan') ?? '')).toEqual([{ site: '左手', type: 'PIV' }]);
    expect(JSON.parse(body.get('fluidPlanDetail') ?? '')).toEqual([{ fluidCode: 'NS', volumeMl: 500 }]);
    expect(JSON.parse(body.get('transfusionPlan') ?? '')).toEqual({ required: false });
    expect(JSON.parse(body.get('backupPlan') ?? '')).toEqual({ method: 'LMA' });
    expect(JSON.parse(body.get('riskResponsePlan') ?? '')).toEqual([{ risk: 'PONV', action: '预防' }]);
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

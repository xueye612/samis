import { beforeEach, describe, expect, it, vi } from 'vitest';

const captured: Array<{ path: string; body?: string }> = [];
vi.mock('@/api/samisClient', () => ({
  samisRequest: vi.fn(async (path: string, init?: RequestInit) => {
    captured.push({ path, body: typeof init?.body === 'string' ? init.body : undefined });
    return {};
  }),
}));

const { anesthesiaHandoverApi, anesthesiaSummaryApi } = await import('@/api/anesthesiaWorkflow');
const body = () => new URLSearchParams(captured[captured.length - 1]?.body ?? '');

describe('P09 anesthesia workflow api', () => {
  beforeEach(() => { captured.length = 0; });

  it('serializes all structured handover sections without dropping arrays', async () => {
    await anesthesiaHandoverApi.saveDraft({
      operationId: 'OP-1', expectedVersion: 2,
      responsibilities: [{ code: 'ANES', label: '麻醉管理' }],
      activeProblems: [{ code: 'BP', description: '血压波动' }],
      riskItems: [{ code: 'AIRWAY', level: 'high' }],
      equipment: [{ code: 'MON', status: 'normal' }],
      lines: [{ type: 'IV', site: '左上肢' }],
      activeMedications: [{ name: '丙泊酚', rate: '10ml/h' }],
      pendingTasks: [{ code: 'LAB', description: '复查血气' }],
      checks: [{ itemCode: 'AIRWAY', result: 'exception', remark: '继续观察' }],
    });
    expect(body().get('expectedVersion')).toBe('2');
    expect(JSON.parse(body().get('activeProblems') ?? '[]')[0].description).toBe('血压波动');
    expect(JSON.parse(body().get('checks') ?? '[]')[0]).toMatchObject({ result: 'exception', remark: '继续观察' });
  });

  it('uses GET for summary detail and explicit version for generation', async () => {
    await anesthesiaSummaryApi.detail('OP/1');
    expect(captured[0]).toEqual({ path: '/anesthesiaSummary/detail?operationId=OP%2F1', body: undefined });
    await anesthesiaSummaryApi.generate({ operationId: 'OP/1', expectedVersion: 0 });
    expect(captured[1].path).toBe('/anesthesiaSummary/generate');
    expect(body().get('expectedVersion')).toBe('0');
  });

  it('keeps doctor supplement separate from generated payload', async () => {
    await anesthesiaSummaryApi.saveDraft({
      summaryVersionId: 'SUMV-1', expectedVersion: 3,
      doctorSupplement: { effectRating: '优', otherNotes: '保留医生意见' },
    });
    expect(JSON.parse(body().get('doctorSupplement') ?? '{}')).toEqual({ effectRating: '优', otherNotes: '保留医生意见' });
    expect(body().has('generatedPayload')).toBe(false);
  });
});

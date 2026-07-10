import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { anesthesiaCases } from '@/mock/anesthesiaCases';

let service: typeof import('@/services/anesthesia/preoperativeAssessmentService');

beforeAll(async () => {
  vi.stubEnv('VITE_ANESTHESIA_USE_MOCK', 'true');
  vi.stubEnv('VITE_USE_REAL_PREOPERATIVE', 'false');
  service = await import('@/services/anesthesia/preoperativeAssessmentService');
});

afterAll(() => vi.unstubAllEnvs());

describe('preoperative assessment api adapter', () => {
  const operationId = anesthesiaCases[0].id;

  it('returns operationCase separately from a mock assessment', async () => {
    const detail = await service.loadPreoperativeAssessment(operationId);
    expect(detail.operationCase).toEqual(expect.objectContaining({
      operationId,
      patientName: anesthesiaCases[0].patientName,
      operationName: anesthesiaCases[0].surgeryName,
    }));
    expect(detail.assessment).toBeNull();
    expect(detail.persistence.available).toBe(true);
  });

  it('saves only assessment fields and supports submit/cancel', async () => {
    const source = {
      asaGrade: 'III',
      anesthesiaPlan: '全身麻醉',
      airwayAssessment: 'Mallampati II',
      allergyHistory: '无',
      patientName: '不得保存的姓名',
      departmentName: '不得保存的科室',
      operationName: '不得保存的手术',
    };
    const payload = service.buildPreoperativeAssessmentDraftPayload(operationId, source);
    expect(payload).not.toHaveProperty('patientName');
    expect(payload).not.toHaveProperty('departmentName');
    expect(payload).not.toHaveProperty('operationName');

    const draft = await service.savePreoperativeAssessmentDraft(operationId, source);
    expect(draft).toEqual(expect.objectContaining({ operationId, status: 'draft', asaGrade: 'III' }));
    const submitted = await service.submitPreoperativeAssessment(operationId);
    expect(submitted.status).toBe('submitted');
    const cancelled = await service.cancelPreoperativeAssessmentSubmit(operationId);
    expect(cancelled.status).toBe('draft');

    const detail = await service.loadPreoperativeAssessment(operationId);
    expect(detail.assessment).toEqual(expect.objectContaining({ operationId, status: 'draft' }));
    expect(detail.assessment).not.toHaveProperty('patientName');
  });
});

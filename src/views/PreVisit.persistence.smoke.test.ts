import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreoperativeAssessmentApi, PreoperativeAssessmentDraftPayload } from '@/api/preoperative';

const operationId = 'OP-E2E-PREOP-PAGE-SMOKE';
let stored: PreoperativeAssessmentApi | null;

const operationCase = {
  operationId,
  patientName: '通知单患者',
  departmentName: 'E2E科室',
  operationName: 'E2E手术',
};

function makeDraft(payload: PreoperativeAssessmentDraftPayload): PreoperativeAssessmentApi {
  return {
    operationId: payload.operationId, version: Number(payload.expectedVersion) + 1,
    assessmentId: 'PA-PAGE-SMOKE',
    asaGrade: String(payload.asaGrade ?? '') || null, anesthesiaPlan: String(payload.anesthesiaPlan ?? '') || null,
    airwayAssessment: String(payload.airwayAssessment ?? '') || null, allergyHistory: null, pastAnesthesiaHistory: null,
    abnormalExamSummary: null, riskSummary: null, preMedicationAdvice: null, riskLevel: null,
    cardiopulmonaryJson: null, airwayJson: null, fastingJson: null, dentitionJson: null, medicalHistoryJson: null,
    surgicalHistoryJson: null, medicationHistoryJson: null, systemAssessmentJson: null, examAbnormalitiesJson: null,
    riskFactorsJson: null, recommendationsJson: null,
    status: 'draft',
    evaluatorId: null, evaluatorName: null, evaluatedAt: null,
    submittedAt: null,
    updatedAt: '2026-07-10 19:20:00',
  };
}

vi.mock('@/api/preoperative', () => ({
  preoperativeApi: {
    assessmentDetail: vi.fn(async () => ({ operationCase, assessment: stored, history: [], persistence: { available: true, reason: null } })),
    assessmentSaveDraft: vi.fn(async (payload: PreoperativeAssessmentDraftPayload) => {
      stored = makeDraft(payload);
      return stored;
    }),
    assessmentSubmit: vi.fn(async () => {
      if (!stored) throw new Error('评估不存在');
      stored = { ...stored, version: stored.version + 1, status: 'submitted', submittedAt: '2026-07-10 19:21:00', updatedAt: '2026-07-10 19:21:00' };
      return stored;
    }),
    assessmentCancelSubmit: vi.fn(async () => {
      if (!stored) throw new Error('评估不存在');
      stored = { ...stored, version: stored.version + 1, status: 'draft', submittedAt: null, updatedAt: '2026-07-10 19:22:00' };
      return stored;
    }),
  },
}));

describe('PreVisit persistence workflow smoke', () => {
  beforeEach(() => { stored = null; });

  it('loads OperationCase, saves, submits, reloads and cancels across page refresh semantics', async () => {
    const service = await import('@/services/anesthesia/preoperativeAssessmentService');
    const initial = await service.loadPreoperativeAssessment(operationId);
    expect(initial.operationCase).toEqual(operationCase);
    expect(initial.assessment).toBeNull();
    expect(initial.persistence.available).toBe(true);

    const source = {
      version: 0,
      asaGrade: 'III',
      anesthesiaPlan: '页面真实模式冒烟计划',
      airwayAssessment: 'Mallampati II',
      patientName: '不得进入 payload',
      operationName: '不得进入 payload',
    };
    const draft = await service.savePreoperativeAssessmentDraft(operationId, source);
    expect(draft.status).toBe('draft');
    expect((await service.submitPreoperativeAssessment(draft)).status).toBe('submitted');

    // 页面刷新会重新调用 detail；状态与评估内容必须从持久层恢复。
    const refreshed = await service.loadPreoperativeAssessment(operationId);
    expect(refreshed.assessment).toEqual(expect.objectContaining({
      operationId,
      status: 'submitted',
      asaGrade: 'III',
      anesthesiaPlan: '页面真实模式冒烟计划',
    }));
    expect(refreshed.assessment).not.toHaveProperty('patientName');
    expect(refreshed.assessment).not.toHaveProperty('operationName');

    expect((await service.cancelPreoperativeAssessmentSubmit(refreshed.assessment!, '补充检查')).status).toBe('draft');
    expect((await service.loadPreoperativeAssessment(operationId)).assessment).toEqual(expect.objectContaining({
      status: 'draft',
      submittedAt: null,
    }));
  });
});

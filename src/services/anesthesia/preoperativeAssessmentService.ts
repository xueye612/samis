import { preoperativeApi } from '@/api/preoperative';
import type {
  PreoperativeAssessmentApi,
  PreoperativeAssessmentDetailApi,
  PreoperativeAssessmentDraftPayload,
} from '@/api/preoperative';

const DRAFT_FIELDS = [
  'asaGrade',
  'anesthesiaPlan',
  'airwayAssessment',
  'allergyHistory',
  'pastAnesthesiaHistory',
  'abnormalExamSummary',
  'riskSummary',
  'preMedicationAdvice',
  'evaluatorId',
  'evaluatorName',
  'evaluatedAt',
] as const;

export function emptyPreoperativeAssessment(operationId: string): PreoperativeAssessmentApi {
  return {
    operationId,
    assessmentId: null,
    asaGrade: null,
    anesthesiaPlan: null,
    airwayAssessment: null,
    allergyHistory: null,
    pastAnesthesiaHistory: null,
    abnormalExamSummary: null,
    riskSummary: null,
    preMedicationAdvice: null,
    status: 'draft',
    evaluatorId: null,
    evaluatorName: null,
    evaluatedAt: null,
    submittedAt: null,
    updatedAt: null,
  };
}

export function buildPreoperativeAssessmentDraftPayload(
  operationId: string,
  source: Partial<PreoperativeAssessmentApi> & Record<string, unknown>,
): PreoperativeAssessmentDraftPayload {
  const payload = { operationId } as PreoperativeAssessmentDraftPayload;
  DRAFT_FIELDS.forEach((field) => {
    payload[field] = (source[field] ?? null) as never;
  });
  return payload;
}

export function loadPreoperativeAssessment(operationId: string): Promise<PreoperativeAssessmentDetailApi> {
  return preoperativeApi.assessmentDetail(operationId);
}

export function savePreoperativeAssessmentDraft(
  operationId: string,
  source: Partial<PreoperativeAssessmentApi> & Record<string, unknown>,
): Promise<PreoperativeAssessmentApi> {
  return preoperativeApi.assessmentSaveDraft(buildPreoperativeAssessmentDraftPayload(operationId, source));
}

export function submitPreoperativeAssessment(operationId: string): Promise<PreoperativeAssessmentApi> {
  return preoperativeApi.assessmentSubmit(operationId);
}

export function cancelPreoperativeAssessmentSubmit(operationId: string): Promise<PreoperativeAssessmentApi> {
  return preoperativeApi.assessmentCancelSubmit(operationId);
}

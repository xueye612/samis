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
  'riskLevel', 'cardiopulmonaryJson', 'airwayJson', 'fastingJson', 'dentitionJson',
  'medicalHistoryJson', 'surgicalHistoryJson', 'medicationHistoryJson', 'systemAssessmentJson',
  'examAbnormalitiesJson', 'riskFactorsJson', 'recommendationsJson',
] as const;

export function emptyPreoperativeAssessment(operationId: string): PreoperativeAssessmentApi {
  return {
    operationId,
    assessmentId: null,
    version: 0,
    asaGrade: null,
    anesthesiaPlan: null,
    airwayAssessment: null,
    allergyHistory: null,
    pastAnesthesiaHistory: null,
    abnormalExamSummary: null,
    riskSummary: null,
    preMedicationAdvice: null,
    riskLevel: null, cardiopulmonaryJson: null, airwayJson: null, fastingJson: null, dentitionJson: null,
    medicalHistoryJson: null, surgicalHistoryJson: null, medicationHistoryJson: null, systemAssessmentJson: null,
    examAbnormalitiesJson: null, riskFactorsJson: null, recommendationsJson: null,
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
  const payload = { operationId, expectedVersion: Number(source.version ?? 0) } as PreoperativeAssessmentDraftPayload;
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

export function submitPreoperativeAssessment(record: Pick<PreoperativeAssessmentApi, 'operationId' | 'version'>): Promise<PreoperativeAssessmentApi> {
  return preoperativeApi.assessmentSubmit({ operationId: record.operationId, expectedVersion: record.version });
}

export function cancelPreoperativeAssessmentSubmit(record: Pick<PreoperativeAssessmentApi, 'operationId' | 'version'>, reason: string): Promise<PreoperativeAssessmentApi> {
  return preoperativeApi.assessmentCancelSubmit({ operationId: record.operationId, expectedVersion: record.version, reason });
}

export function createPreoperativeAssessmentRevision(record: Pick<PreoperativeAssessmentApi, 'operationId' | 'version'>, reason: string): Promise<PreoperativeAssessmentApi> {
  return preoperativeApi.assessmentCreateRevision({ operationId: record.operationId, expectedVersion: record.version, reason });
}

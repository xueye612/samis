import {
  preoperativeFiveFlowsApi,
  type PreopConsent,
  type PreopConsultation,
  type PreopExamReview,
  type PreopRequest,
  type PreopSafetySummary,
} from '@/api/preoperative';
import { SamisHttpError } from '@/api/samisHttpClient';
import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';

export class PreopConflictError extends Error {
  constructor(message = '数据版本冲突，请刷新后重试') {
    super(message);
    this.name = 'PreopConflictError';
  }
}

export function hasPreopPermission(permissions: string[] | null | undefined, code: string): boolean {
  return Boolean(permissions?.some((item) => item === '*' || item === 'preop.*' || item === code));
}

function unwrap<T>(response: unknown): T {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as { data: T }).data;
  }
  return response as T;
}

async function withConflict<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof SamisHttpError && error.code === 4091) throw new PreopConflictError();
    throw error;
  }
}

function listOf<T>(raw: unknown): T[] {
  const data = unwrap<{ list?: T[] }>(raw);
  return data?.list ?? [];
}

export async function loadRequestList(params: Record<string, unknown> = {}): Promise<PreopRequest[]> {
  return listOf<PreopRequest>(await preoperativeFiveFlowsApi.requestList(params));
}

export async function loadOperationCases(): Promise<OperationCase[]> {
  const requests = await loadRequestList({ pageSize: 200 });
  const map = new Map<string, OperationCase>();
  requests.forEach((item) => {
    if (item.operationCase?.operationId) map.set(item.operationCase.operationId, item.operationCase);
  });
  return [...map.values()];
}

export async function receiveRequest(record: Pick<PreopRequest, 'id' | 'operationId' | 'version'>): Promise<PreopRequest> {
  return withConflict(async () => unwrap<PreopRequest>(await preoperativeFiveFlowsApi.requestReceive({
    id: record.id,
    operationId: record.operationId,
    expectedVersion: record.version,
  })));
}

export async function cancelRequest(record: Pick<PreopRequest, 'id' | 'operationId' | 'version'>, reason: string): Promise<PreopRequest> {
  return withConflict(async () => unwrap<PreopRequest>(await preoperativeFiveFlowsApi.requestCancel({
    id: record.id,
    operationId: record.operationId,
    expectedVersion: record.version,
    cancelReason: reason,
  })));
}

export async function loadConsultationList(params: Record<string, unknown> = {}): Promise<PreopConsultation[]> {
  return listOf<PreopConsultation>(await preoperativeFiveFlowsApi.consultationList(params));
}

export async function createConsultation(operationId: string, params: Record<string, unknown>): Promise<PreopConsultation> {
  return withConflict(async () => unwrap<PreopConsultation>(await preoperativeFiveFlowsApi.consultationCreate({ operationId, ...params })));
}

export async function updateConsultation(record: PreopConsultation, params: Record<string, unknown>): Promise<PreopConsultation> {
  return withConflict(async () => unwrap<PreopConsultation>(await preoperativeFiveFlowsApi.consultationUpdate({ id: record.id, expectedVersion: record.version, ...params })));
}

export async function submitConsultation(record: PreopConsultation): Promise<PreopConsultation> {
  return withConflict(async () => unwrap<PreopConsultation>(await preoperativeFiveFlowsApi.consultationSubmit({ id: record.id, expectedVersion: record.version })));
}

export async function cancelConsultation(record: PreopConsultation, reason: string): Promise<PreopConsultation> {
  return withConflict(async () => unwrap<PreopConsultation>(await preoperativeFiveFlowsApi.consultationCancel({ id: record.id, expectedVersion: record.version, cancelReason: reason })));
}

export async function loadExamReviewList(params: Record<string, unknown> = {}): Promise<PreopExamReview[]> {
  return listOf<PreopExamReview>(await preoperativeFiveFlowsApi.examReviewList(params));
}

export async function createExamReview(operationId: string, params: Record<string, unknown>): Promise<PreopExamReview> {
  return withConflict(async () => unwrap<PreopExamReview>(await preoperativeFiveFlowsApi.examReviewCreate({ operationId, ...params })));
}

export async function updateExamReview(record: PreopExamReview, params: Record<string, unknown>): Promise<PreopExamReview> {
  return withConflict(async () => unwrap<PreopExamReview>(await preoperativeFiveFlowsApi.examReviewUpdate({ id: record.id, expectedVersion: record.version, ...params })));
}

export async function loadConsentByCaseId(operationId: string): Promise<PreopConsent | null> {
  const data = unwrap<PreopConsent | null>(await preoperativeFiveFlowsApi.consentGetByCaseId(operationId));
  return data && Object.keys(data).length ? data : null;
}

export async function createConsent(operationId: string, params: Record<string, unknown>): Promise<PreopConsent> {
  return withConflict(async () => unwrap<PreopConsent>(await preoperativeFiveFlowsApi.consentCreate({ operationId, ...params })));
}

export async function updateConsent(record: PreopConsent, params: Record<string, unknown>): Promise<PreopConsent> {
  return withConflict(async () => unwrap<PreopConsent>(await preoperativeFiveFlowsApi.consentUpdate({ id: record.id, expectedVersion: record.version, ...params })));
}

export async function prepareConsentSigning(record: PreopConsent, signingMode = 'patient'): Promise<PreopConsent> {
  return withConflict(async () => unwrap<PreopConsent>(await preoperativeFiveFlowsApi.consentPrepareSigning({ id: record.id, expectedVersion: record.version, signingMode })));
}

export async function submitConsent(record: PreopConsent): Promise<PreopConsent> {
  return withConflict(async () => unwrap<PreopConsent>(await preoperativeFiveFlowsApi.consentSubmit({ id: record.id, expectedVersion: record.version })));
}

export async function withdrawConsent(record: PreopConsent, reason: string): Promise<PreopConsent> {
  return withConflict(async () => unwrap<PreopConsent>(await preoperativeFiveFlowsApi.consentWithdraw({ id: record.id, expectedVersion: record.version, reason })));
}

export async function markConsentPrinted(record: PreopConsent): Promise<PreopConsent> {
  return withConflict(async () => unwrap<PreopConsent>(await preoperativeFiveFlowsApi.consentMarkPrinted({ id: record.id, expectedVersion: record.version })));
}

export async function archiveConsent(record: PreopConsent): Promise<PreopConsent> {
  return withConflict(async () => unwrap<PreopConsent>(await preoperativeFiveFlowsApi.consentArchive({ id: record.id, expectedVersion: record.version })));
}

export async function loadSafetySummary(operationId: string): Promise<PreopSafetySummary> {
  return unwrap<PreopSafetySummary>(await preoperativeFiveFlowsApi.safetyCheckSummary(operationId));
}

export async function confirmSafetyRole(operationId: string, stage: string, confirmed: boolean, reason?: string): Promise<PreopSafetySummary> {
  const response = unwrap<{ summary?: PreopSafetySummary }>(await preoperativeFiveFlowsApi.safetyConfirmRole({ operationId, stage, confirmed, reason }));
  if (!response?.summary) return loadSafetySummary(operationId);
  return response.summary;
}

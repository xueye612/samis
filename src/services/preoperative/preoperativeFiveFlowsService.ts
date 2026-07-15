import { preoperativeFiveFlowsApi, type PreopRequest, type PreopSafetySummary } from '@/api/preoperative';
import { preoperativeApi } from '@/api/preoperative';
import { SamisHttpError } from '@/api/samisHttpClient';

export class PreopConflictError extends Error {
  constructor(message = '数据版本冲突，请刷新后重试') { super(message); this.name = 'PreopConflictError'; }
}

function unwrap(response: unknown): unknown {
  if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>;
    if (r.data !== undefined) return r.data;
  }
  return response;
}

function throwIfConflict(error: unknown): never {
  if (error instanceof SamisHttpError && error.code === 4091) throw new PreopConflictError();
  throw error;
}

// === 申请 ===
export async function loadRequestList(params: Record<string, unknown> = {}): Promise<PreopRequest[]> {
  const raw = await preoperativeFiveFlowsApi.requestList(params);
  const data = unwrap(raw) as { list?: PreopRequest[] };
  return data?.list ?? [];
}

export async function receiveRequest(id: number, expectedVersion: number): Promise<void> {
  try { await preoperativeFiveFlowsApi.requestReceive({ id, expectedVersion }); }
  catch (e) { throwIfConflict(e); }
}

export async function cancelRequest(id: number, expectedVersion: number, reason?: string): Promise<void> {
  try { await preoperativeFiveFlowsApi.requestCancel({ id, expectedVersion, cancelReason: reason }); }
  catch (e) { throwIfConflict(e); }
}

// === 会诊 ===
export async function loadConsultationList(params: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> {
  const raw = await preoperativeApi.consultationList(params);
  const data = unwrap(raw) as { list?: Record<string, unknown>[] };
  return data?.list ?? [];
}

export async function createConsultation(operationId: string, params: Record<string, unknown>): Promise<{ id?: number }> {
  try {
    const raw = await preoperativeApi.consultationCreate({ operationId, ...params });
    const data = unwrap(raw) as Record<string, unknown>;
    return { id: data?.id !== undefined ? Number(data.id) : undefined };
  } catch (e) { throwIfConflict(e); }
}

export async function updateConsultation(id: number, params: Record<string, unknown>): Promise<void> {
  try { await preoperativeApi.consultationUpdate({ id, ...params }); }
  catch (e) { throwIfConflict(e); }
}

export async function submitConsultation(id: number): Promise<void> {
  await preoperativeApi.consultationSubmit(id);
}

export async function cancelConsultation(id: number, reason: string): Promise<void> {
  await preoperativeApi.consultationCancel(id, reason);
}

// === 同意 ===
export async function loadConsentByCaseId(caseId: string): Promise<Record<string, unknown> | null> {
  const raw = await preoperativeApi.consentGetByCaseId(caseId);
  const data = unwrap(raw);
  if (!data || (typeof data === 'object' && Object.keys(data as object).length === 0)) return null;
  return data as Record<string, unknown>;
}

export async function createConsent(operationId: string, params: Record<string, unknown>): Promise<{ id?: number }> {
  try {
    const raw = await preoperativeApi.consentCreate({ operationId, ...params });
    const data = unwrap(raw) as Record<string, unknown>;
    return { id: data?.id !== undefined ? Number(data.id) : undefined };
  } catch (e) { throwIfConflict(e); }
}

export async function updateConsent(id: number, params: Record<string, unknown>): Promise<void> {
  try { await preoperativeApi.consentUpdate({ id, ...params }); }
  catch (e) { throwIfConflict(e); }
}

export async function submitConsent(id: number): Promise<void> {
  await preoperativeApi.consentSubmit(id);
}

export async function withdrawConsent(id: number, reason?: string): Promise<void> {
  await preoperativeApi.consentWithdraw(id);
}

export async function markConsentPrinted(id: number): Promise<void> {
  await preoperativeApi.consentMarkPrinted(id);
}

export async function archiveConsent(id: number): Promise<void> {
  await preoperativeApi.consentArchive(id);
}

// === 护理安全核查 ===
export async function loadSafetySummary(operationId: string): Promise<PreopSafetySummary | null> {
  try {
    const raw = await preoperativeFiveFlowsApi.safetyCheckSummary(operationId);
    return unwrap(raw) as PreopSafetySummary;
  } catch { return null; }
}

export async function confirmSafetyRole(operationId: string, stage: string, confirmed: boolean, reason?: string): Promise<void> {
  await preoperativeFiveFlowsApi.safetyConfirmRole({ operationId, stage, confirmed, reason });
}

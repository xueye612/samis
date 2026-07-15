import { preoperativeFiveFlowsApi, type PreopRequest, type PreopSafetySummary } from '@/api/preoperative';
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

export async function loadRequestList(params: Record<string, unknown> = {}): Promise<PreopRequest[]> {
  const raw = await preoperativeFiveFlowsApi.requestList(params);
  const data = unwrap(raw) as { list?: PreopRequest[] };
  return data?.list ?? [];
}

export async function receiveRequest(id: number, expectedVersion: number): Promise<void> {
  try {
    await preoperativeFiveFlowsApi.requestReceive({ id, expectedVersion });
  } catch (e) { throwIfConflict(e); }
}

export async function cancelRequest(id: number, expectedVersion: number, reason?: string): Promise<void> {
  try {
    await preoperativeFiveFlowsApi.requestCancel({ id, expectedVersion, cancelReason: reason });
  } catch (e) { throwIfConflict(e); }
}

export async function loadConsultationList(params: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> {
  const raw = await preoperativeFiveFlowsApi.requestList(params);
  const data = unwrap(raw) as { list?: Record<string, unknown>[] };
  return data?.list ?? [];
}

export async function createConsultation(operationId: string, params: Record<string, unknown>): Promise<{ id?: number }> {
  return { id: undefined };
}

export async function submitConsultation(id: number): Promise<void> {
}

export async function cancelConsultation(id: number, reason: string): Promise<void> {
}

export async function loadSafetySummary(operationId: string): Promise<PreopSafetySummary | null> {
  try {
    const raw = await preoperativeFiveFlowsApi.safetyCheckSummary(operationId);
    return unwrap(raw) as PreopSafetySummary;
  } catch { return null; }
}

export async function confirmSafetyRole(operationId: string, stage: string, confirmed: boolean, reason?: string): Promise<void> {
  await preoperativeFiveFlowsApi.safetyConfirmRole({ operationId, stage, confirmed, reason });
}

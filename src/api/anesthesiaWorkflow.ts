import { samisRequest } from '@/api/samisClient';
import { buildFormPost, type FormRecord } from '@/api/samisFormBody';

function workflowFormFields(data: Record<string, unknown>): FormRecord {
  const fields: FormRecord = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    fields[key] = typeof value === 'object' ? JSON.stringify(value) : value as string | number | boolean;
  });
  return fields;
}

// ---- 麻醉计划 ----
export interface AnesthesiaPlanApi {
  planId: string;
  planVersionId: string;
  operationId: string;
  version: number;
  status: 'draft' | 'submitted' | 'cancelled';
  primaryMethodCode: string | null;
  primaryMethodName: string | null;
  alternativeMethods: unknown[] | null;
  airwayPlan: Record<string, unknown> | null;
  monitoringPlan: Record<string, unknown> | null;
  inductionPlan: string | null;
  maintenancePlan: string | null;
  analgesiaPlan: string | null;
  fluidPlan: string | null;
  bloodPreparation: string | null;
  postoperativeDestination: string | null;
  specialRisks: unknown[] | null;
  notes: string | null;
  revisionReason: string | null;
  submittedAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AnesthesiaPlanDetailApi {
  operationId: string;
  currentPlan: AnesthesiaPlanApi | null;
  historyMeta: { total: number; versions: Array<{ planVersionId: string; version: number; status: string; createdAt: string | null }> };
}

export const anesthesiaPlanApi = {
  detail(operationId: string) {
    return samisRequest<AnesthesiaPlanDetailApi>(
      `/anesthesiaPlan/detail?operationId=${encodeURIComponent(operationId)}`, undefined, { module: 'anesthesiaRecord' },
    );
  },
  saveDraft(data: Record<string, unknown>) { return samisRequest<AnesthesiaPlanApi>('/anesthesiaPlan/saveDraft', buildFormPost(workflowFormFields(data)), { module: 'anesthesiaRecord' }); },
  submit(data: Record<string, unknown>) { return samisRequest<AnesthesiaPlanApi>('/anesthesiaPlan/submit', buildFormPost(workflowFormFields(data)), { module: 'anesthesiaRecord' }); },
  createRevision(data: Record<string, unknown>) { return samisRequest<AnesthesiaPlanApi>('/anesthesiaPlan/createRevision', buildFormPost(workflowFormFields(data)), { module: 'anesthesiaRecord' }); },
  cancel(data: Record<string, unknown>) { return samisRequest<AnesthesiaPlanApi>('/anesthesiaPlan/cancel', buildFormPost(workflowFormFields(data)), { module: 'anesthesiaRecord' }); },
  history(operationId: string, page = 1, pageSize = 20) {
    return samisRequest<{ list: AnesthesiaPlanApi[]; total: number }>(
      `/anesthesiaPlan/history?operationId=${encodeURIComponent(operationId)}&page=${page}&page_size=${pageSize}`, undefined, { module: 'anesthesiaRecord' },
    );
  },
};

// ---- 麻醉交班 ----
export interface AnesthesiaHandoverApi {
  handoverId: string;
  handoverVersionId: string;
  operationId: string;
  version: number;
  handoverType: string;
  status: 'draft' | 'submitted' | 'accepted' | 'cancelled';
  outgoingDoctorId: string;
  outgoingDoctorName: string;
  incomingDoctorId: string | null;
  incomingDoctorName: string | null;
  handoverAt: string | null;
  acceptedAt: string | null;
  priorityNotes: string | null;
  specialNotes: string | null;
  emergencyReason: string | null;
  pendingTasks: string[];
  checks: Array<{ itemCode: string; result: 'pending' | 'normal' | 'exception'; remark: string }>;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AnesthesiaHandoverDetailApi {
  operationId: string;
  activeHandover: AnesthesiaHandoverApi | null;
  currentResponsibleDoctor: { doctorId: string; doctorName: string; acceptedAt: string | null } | null;
  history: AnesthesiaHandoverApi[];
}

export const anesthesiaHandoverApi = {
  detail(operationId: string) {
    return samisRequest<AnesthesiaHandoverDetailApi>(
      `/anesthesiaHandover/detail?operationId=${encodeURIComponent(operationId)}`, undefined, { module: 'anesthesiaRecord' },
    );
  },
  saveDraft(data: Record<string, unknown>) { return samisRequest<AnesthesiaHandoverApi>('/anesthesiaHandover/saveDraft', buildFormPost(workflowFormFields(data)), { module: 'anesthesiaRecord' }); },
  submit(data: Record<string, unknown>) { return samisRequest<AnesthesiaHandoverApi>('/anesthesiaHandover/submit', buildFormPost(workflowFormFields(data)), { module: 'anesthesiaRecord' }); },
  accept(data: Record<string, unknown>) { return samisRequest<AnesthesiaHandoverApi>('/anesthesiaHandover/accept', buildFormPost(workflowFormFields(data)), { module: 'anesthesiaRecord' }); },
  cancelDraft(data: Record<string, unknown>) { return samisRequest<AnesthesiaHandoverApi>('/anesthesiaHandover/cancelDraft', buildFormPost(workflowFormFields(data)), { module: 'anesthesiaRecord' }); },
  history(operationId: string, page = 1, pageSize = 20) {
    return samisRequest<{ list: AnesthesiaHandoverApi[]; total: number }>(
      `/anesthesiaHandover/history?operationId=${encodeURIComponent(operationId)}&page=${page}&page_size=${pageSize}`, undefined, { module: 'anesthesiaRecord' },
    );
  },
};

// ---- 麻醉小结 ----
export interface AnesthesiaSummaryApi {
  summaryId: string;
  summaryVersionId: string;
  operationId: string;
  version: number;
  status: 'draft' | 'submitted' | 'signed' | 'cancelled';
  generatedPayload: unknown;
  effectRating: string | null;
  intraoperativeNotes: string | null;
  recoveryNotes: string | null;
  complicationSummary: string | null;
  postoperativeDestination: string | null;
  submittedAt: string | null;
  revisionReason: string | null;
  createdAt: string | null;
}

export const anesthesiaSummaryApi = {
  generate(operationId: string, recordRevisionId?: string) { return samisRequest<AnesthesiaSummaryApi>('/anesthesiaSummary/generate', buildFormPost({ operationId, recordRevisionId }), { module: 'anesthesiaRecord' }); },
  saveDraft(data: Record<string, unknown>) { return samisRequest<AnesthesiaSummaryApi>('/anesthesiaSummary/saveDraft', buildFormPost(workflowFormFields(data)), { module: 'anesthesiaRecord' }); },
  submit(data: Record<string, unknown>) { return samisRequest<AnesthesiaSummaryApi>('/anesthesiaSummary/submit', buildFormPost(workflowFormFields(data)), { module: 'anesthesiaRecord' }); },
  createRevision(data: Record<string, unknown>) { return samisRequest<AnesthesiaSummaryApi>('/anesthesiaSummary/createRevision', buildFormPost(workflowFormFields(data)), { module: 'anesthesiaRecord' }); },
  history(operationId: string, page = 1, pageSize = 20) {
    return samisRequest<{ list: AnesthesiaSummaryApi[]; total: number }>(
      `/anesthesiaSummary/history?operationId=${encodeURIComponent(operationId)}&page=${page}&page_size=${pageSize}`, undefined, { module: 'anesthesiaRecord' },
    );
  },
};

// ---- 术后镇痛 ----
export type AnalgesiaStatus = 'draft' | 'active' | 'paused' | 'stopped' | 'completed' | 'voided';

export interface PostAnalgesiaPlanApi {
  planId: string;
  planVersionId: string;
  operationId: string;
  version: number;
  status: AnalgesiaStatus;
  methodCode: string | null;
  formula: unknown;
  pumpTotalMl: number | null;
  backgroundRateMlH: number | null;
  bolusMl: number | null;
  lockoutMinutes: number | null;
  prescribedBy: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  stoppedAt: string | null;
  completedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PostAnalgesiaDetailApi {
  operationId: string;
  currentPlan: PostAnalgesiaPlanApi | null;
  adjustments: PostAnalgesiaAdjustmentApi[];
  assessments: PostAnalgesiaAssessmentApi[];
}

export interface PostAnalgesiaAdjustmentApi {
  adjustmentId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  adjustedBy: string | null;
  adjustedAt: string | null;
}

export interface PostAnalgesiaAssessmentApi {
  assessmentId: string;
  assessedAt: string | null;
  vasScore: number | null;
  sedationScore: number | null;
  ponvScore: number | null;
  pruritusScore: number | null;
  respiratoryDepression: boolean;
  rescueDose: Record<string, unknown> | null;
  assessorId: string | null;
}

export const postAnalgesiaApi = {
  detail(operationId: string) {
    return samisRequest<PostAnalgesiaDetailApi>(
      `/postoperative/analgesiaDetail?operationId=${encodeURIComponent(operationId)}`, undefined, { module: 'postoperative' },
    );
  },
  saveDraft(data: Record<string, unknown>) { return samisRequest<PostAnalgesiaPlanApi>('/postoperative/analgesiaSaveDraft', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
  start(data: { planVersionId: string; expectedVersion: number }) { return samisRequest<PostAnalgesiaPlanApi>('/postoperative/analgesiaStart', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
  pause(data: { planVersionId: string; expectedVersion: number }) { return samisRequest<PostAnalgesiaPlanApi>('/postoperative/analgesiaPause', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
  resume(data: { planVersionId: string; expectedVersion: number }) { return samisRequest<PostAnalgesiaPlanApi>('/postoperative/analgesiaResume', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
  stop(data: { planVersionId: string; expectedVersion: number }) { return samisRequest<PostAnalgesiaPlanApi>('/postoperative/analgesiaStop', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
  complete(data: { planVersionId: string; expectedVersion: number }) { return samisRequest<PostAnalgesiaPlanApi>('/postoperative/analgesiaComplete', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
  void(data: { planVersionId: string; expectedVersion: number; reason: string }) { return samisRequest<PostAnalgesiaPlanApi>('/postoperative/analgesiaVoid', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
  adjust(data: { planVersionId: string; expectedVersion: number; nextParameters: Record<string, unknown>; reason: string }) {
    return samisRequest<{ adjustmentId: string; plan: PostAnalgesiaPlanApi }>('/postoperative/analgesiaAdjust', buildFormPost(workflowFormFields(data)), { module: 'postoperative' });
  },
  assess(data: { planId: string; vasScore?: number; sedationScore?: number; ponvScore?: number; pruritusScore?: number; respiratoryDepression?: boolean }) {
    return samisRequest<{ assessmentId: string; alerts: string[] }>('/postoperative/analgesiaAssess', buildFormPost(workflowFormFields(data)), { module: 'postoperative' });
  },
  history(operationId: string, page = 1, pageSize = 20) {
    return samisRequest<{ list: PostAnalgesiaPlanApi[]; total: number }>(`/postoperative/analgesiaHistory?operationId=${encodeURIComponent(operationId)}&page=${page}&page_size=${pageSize}`, undefined, { module: 'postoperative' });
  },
};

// ---- 非计划事件 ----
export type UnplannedEventStatus = 'draft' | 'reported' | 'under_review' | 'confirmed' | 'excluded' | 'closed';

export interface UnplannedEventApi {
  eventId: string;
  operationId: string;
  eventType: string;
  occurredAt: string | null;
  severity: string;
  status: UnplannedEventStatus;
  version: number;
  discoverySource: string | null;
  cause: string | null;
  treatment: string | null;
  outcome: string | null;
  qualityDefectId: number | null;
  reportedAt: string | null;
  reviewedAt: string | null;
  reviewerId: string | null;
  exclusionReason: string | null;
  closeReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const unplannedEventApi = {
  detail(eventId: string) { return samisRequest<UnplannedEventApi>(`/postoperative/unplannedDetail?eventId=${encodeURIComponent(eventId)}`, undefined, { module: 'postoperative' }); },
  list(params: Record<string, string | number | undefined> = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') q.set(k, String(v)); });
    return samisRequest<{ list: UnplannedEventApi[]; total: number }>(`/postoperative/unplannedList${q.size ? `?${q}` : ''}`, undefined, { module: 'postoperative' });
  },
  saveDraft(data: Record<string, unknown>) { return samisRequest<UnplannedEventApi>('/postoperative/unplannedSaveDraft', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
  report(data: Record<string, unknown>) { return samisRequest<UnplannedEventApi>('/postoperative/unplannedReport', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
  startReview(data: { eventId: string; expectedVersion: number }) { return samisRequest<UnplannedEventApi>('/postoperative/unplannedStartReview', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
  confirm(data: { eventId: string; expectedVersion: number; reviewOpinion?: string }) { return samisRequest<UnplannedEventApi>('/postoperative/unplannedConfirm', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
  exclude(data: { eventId: string; expectedVersion: number; reason: string }) { return samisRequest<UnplannedEventApi>('/postoperative/unplannedExclude', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
  close(data: { eventId: string; expectedVersion: number; reason: string }) { return samisRequest<UnplannedEventApi>('/postoperative/unplannedClose', buildFormPost(workflowFormFields(data)), { module: 'postoperative' }); },
};

import { samisRequest } from '@/api/samisClient';
import { buildFormPost, flatFormFieldsFromRecord, type FormRecord } from '@/api/samisFormBody';
import type { OperationCase } from '@/services/anesthesia/adapters/operationInfoAdapter';

export type PreoperativeAssessmentStatus = 'draft' | 'submitted' | 'cancelled';

export interface PreoperativeAssessmentApi {
  operationId: string;
  assessmentId: string | null;
  version: number;
  asaGrade: string | null;
  anesthesiaPlan: string | null;
  airwayAssessment: string | null;
  allergyHistory: string | null;
  pastAnesthesiaHistory: string | null;
  abnormalExamSummary: string | null;
  riskSummary: string | null;
  preMedicationAdvice: string | null;
  riskLevel: 'low' | 'moderate' | 'high' | null;
  cardiopulmonaryJson: Record<string, unknown> | null;
  airwayJson: Record<string, unknown> | null;
  fastingJson: Record<string, unknown> | null;
  dentitionJson: Record<string, unknown> | null;
  medicalHistoryJson: unknown[] | Record<string, unknown> | null;
  surgicalHistoryJson: unknown[] | null;
  medicationHistoryJson: unknown[] | null;
  systemAssessmentJson: Record<string, unknown> | null;
  examAbnormalitiesJson: unknown[] | null;
  riskFactorsJson: unknown[] | null;
  recommendationsJson: unknown[] | null;
  status: PreoperativeAssessmentStatus;
  evaluatorId: string | null;
  evaluatorName: string | null;
  evaluatedAt: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
}

export interface PreoperativeAssessmentDetailApi {
  operationCase: OperationCase;
  assessment: PreoperativeAssessmentApi | null;
  history: Array<{ revisionId: string; version: number; submittedAt: string | null; submittedBy: string; revisionReason: string | null }>;
  persistence: {
    available: boolean;
    reason: string | null;
  };
}

export type PreoperativeAssessmentDraftPayload = Record<string, unknown> & { operationId: string; expectedVersion: number };

/** 后端 anes_preop_request 行（camelCase，由 PreoperativeService.formatRequestItem 输出） */
export interface PreopRequestApi {
  id: number;
  operationId: string;
  patientName?: string | null;
  department?: string | null;
  surgeryName?: string | null;
  surgeon?: string | null;
  urgency: string;
  requestDate?: string | null;
  status: string;
  receivedAt?: string | null;
  receivedBy?: string | null;
  remark?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** 后端 anes_preop_consultation 行 */
export interface PreopConsultationApi {
  id: number;
  caseId: string;
  operationId?: string | null;
  patientName?: string | null;
  requestDept?: string | null;
  consultDate?: string | null;
  consultant?: string | null;
  opinion?: string | null;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  requestContent?: string | null;
  consultantId?: string | null;
  submittedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  operationCase?: OperationCase;
}

/** 后端 anes_preop_exam_review 行 */
export interface PreopExamReviewApi {
  id: number;
  caseId: string;
  operationId?: string | null;
  patientName?: string | null;
  labItems?: string | null;
  imagingItems?: string | null;
  reviewResult: string;
  reviewer?: string | null;
  reviewDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** 后端 anes_preop_consent 行 */
export interface PreopConsentApi {
  id: number;
  caseId: string;
  operationId?: string | null;
  patientName?: string | null;
  surgeryName?: string | null;
  anesthesiaMethod?: string | null;
  surgeryDate?: string | null;
  commonRisks: boolean;
  severeRisks: boolean;
  specialRisks: boolean;
  planAccepted: boolean;
  questionAnswered: boolean;
  patientSigned: boolean;
  familySigned: boolean;
  doctorSigned: boolean;
  signedAt?: string | null;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  templateCode?: string | null;
  templateVersion?: string | null;
  riskDisclosure?: string | null;
  printStatus?: string;
  archiveStatus?: string;
  operationCase?: OperationCase;
}

/** 后端 anes_preop_safety_check 行 */
export interface PreopSafetyCheckApi {
  id: number;
  caseId: string;
  operationId?: string | null;
  patientName?: string | null;
  signInComplete: boolean;
  timeOutComplete: boolean;
  signOutComplete: boolean;
  checker?: string | null;
  checkDate?: string | null;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RequestListQuery {
  status?: string;
  urgency?: string;
  department?: string;
  requestDateStart?: string;
  requestDateEnd?: string;
  page?: number;
  pageSize?: number;
}

export interface ConsultationListQuery {
  caseId?: string;
  status?: string;
  consultDateStart?: string;
  consultDateEnd?: string;
  page?: number;
  pageSize?: number;
}

export interface ExamReviewListQuery {
  caseId?: string;
  reviewResult?: string;
  reviewDateStart?: string;
  reviewDateEnd?: string;
  page?: number;
  pageSize?: number;
}

export interface ConsentListQuery {
  caseId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface SafetyCheckListQuery {
  caseId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

function buildRequestListQuery(params: RequestListQuery = {}): string {
  return buildQuery({
    status: params.status,
    urgency: params.urgency,
    department: params.department,
    requestDateStart: params.requestDateStart,
    requestDateEnd: params.requestDateEnd,
    page: params.page,
    pageSize: params.pageSize,
  });
}

function buildConsultationListQuery(params: ConsultationListQuery = {}): string {
  return buildQuery({
    caseId: params.caseId,
    status: params.status,
    consultDateStart: params.consultDateStart,
    consultDateEnd: params.consultDateEnd,
    page: params.page,
    pageSize: params.pageSize,
  });
}

function buildExamReviewListQuery(params: ExamReviewListQuery = {}): string {
  return buildQuery({
    caseId: params.caseId,
    reviewResult: params.reviewResult,
    reviewDateStart: params.reviewDateStart,
    reviewDateEnd: params.reviewDateEnd,
    page: params.page,
    pageSize: params.pageSize,
  });
}

function buildConsentListQuery(params: ConsentListQuery = {}): string {
  return buildQuery({
    caseId: params.caseId,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
}

function buildSafetyCheckListQuery(params: SafetyCheckListQuery = {}): string {
  return buildQuery({
    caseId: params.caseId,
    status: params.status,
    page: params.page,
    pageSize: params.pageSize,
  });
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    // 后端分页参数为 page_size（其余直传）
    const paramKey = key === 'pageSize' ? 'page_size' : key;
    query.set(paramKey, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

function postForm<T>(path: string, data: Record<string, unknown>) {
  return samisRequest<T>(`/preoperative${path}`, buildFormPost(flatFormFieldsFromRecord(data)), {
    module: 'preoperative',
  });
}

function postAssessmentForm<T>(path: string, data: Record<string, unknown>) {
  const fields: FormRecord = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    fields[key] = typeof value === 'object' ? JSON.stringify(value) : value as string | number | boolean;
  });
  return samisRequest<T>(`/preoperative${path}`, buildFormPost(fields), { module: 'preoperative' });
}

export const preoperativeApi = {
  assessmentDetail(operationId: string) {
    return samisRequest<PreoperativeAssessmentDetailApi>(
      `/preoperative/assessmentDetail?operationId=${encodeURIComponent(operationId)}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  assessmentSaveDraft(data: PreoperativeAssessmentDraftPayload) {
    return postAssessmentForm<PreoperativeAssessmentApi>('/assessmentSaveDraft', data);
  },
  assessmentSubmit(data: { operationId: string; expectedVersion: number }) {
    return postAssessmentForm<PreoperativeAssessmentApi>('/assessmentSubmit', data);
  },
  assessmentCancelSubmit(data: { operationId: string; expectedVersion: number; reason: string }) {
    return postAssessmentForm<PreoperativeAssessmentApi>('/assessmentCancelSubmit', data);
  },
  assessmentCreateRevision(data: { operationId: string; expectedVersion: number; reason: string }) {
    return postAssessmentForm<PreoperativeAssessmentApi>('/assessmentCreateRevision', data);
  },
  assessmentHistory(operationId: string) {
    return samisRequest<PreoperativeAssessmentDetailApi['history']>(`/preoperative/assessmentHistory?operationId=${encodeURIComponent(operationId)}`, undefined, { module: 'preoperative' });
  },

  // ---- 申请接收 ----
  requestList(params: RequestListQuery = {}) {
    return samisRequest<unknown>(
      `/preoperative/requestList${buildRequestListQuery(params)}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  requestGetById(id: number | string) {
    return samisRequest<unknown>(
      `/preoperative/requestGetById?id=${encodeURIComponent(String(id))}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  requestCreate(data: Record<string, unknown>) {
    return postForm<PreopRequestApi>('/requestCreate', data);
  },
  requestUpdate(data: Record<string, unknown>) {
    return postForm<PreopRequestApi>('/requestUpdate', data);
  },
  requestReceive(id: number | string) {
    return postForm<PreopRequestApi>('/requestReceive', { id });
  },
  requestCancel(id: number | string) {
    return postForm<PreopRequestApi>('/requestCancel', { id });
  },

  // ---- 麻醉会诊 ----
  consultationList(params: ConsultationListQuery = {}) {
    return samisRequest<unknown>(
      `/preoperative/consultationList${buildConsultationListQuery(params)}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  consultationGetById(id: number | string) {
    return samisRequest<unknown>(
      `/preoperative/consultationGetById?id=${encodeURIComponent(String(id))}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  consultationCreate(data: Record<string, unknown>) {
    return postForm<PreopConsultationApi>('/consultationCreate', data);
  },
  consultationUpdate(data: Record<string, unknown>) {
    return postForm<PreopConsultationApi>('/consultationUpdate', data);
  },
  consultationSubmit(id: number | string) { return postForm<PreopConsultationApi>('/consultationSubmit', { id }); },
  consultationCancel(id: number | string, cancelReason = '') { return postForm<PreopConsultationApi>('/consultationCancel', { id, cancelReason }); },

  // ---- 检查审核 ----
  examReviewList(params: ExamReviewListQuery = {}) {
    return samisRequest<unknown>(
      `/preoperative/examReviewList${buildExamReviewListQuery(params)}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  examReviewGetById(id: number | string) {
    return samisRequest<unknown>(
      `/preoperative/examReviewGetById?id=${encodeURIComponent(String(id))}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  examReviewCreate(data: Record<string, unknown>) {
    return postForm<PreopExamReviewApi>('/examReviewCreate', data);
  },
  examReviewUpdate(data: Record<string, unknown>) {
    return postForm<PreopExamReviewApi>('/examReviewUpdate', data);
  },

  // ---- 知情同意 ----
  consentList(params: ConsentListQuery = {}) {
    return samisRequest<unknown>(
      `/preoperative/consentList${buildConsentListQuery(params)}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  consentGetById(id: number | string) {
    return samisRequest<unknown>(
      `/preoperative/consentGetById?id=${encodeURIComponent(String(id))}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  consentGetByCaseId(caseId: string) {
    return samisRequest<unknown>(
      `/preoperative/consentGetByCaseId?caseId=${encodeURIComponent(caseId)}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  consentCreate(data: Record<string, unknown>) {
    return postForm<PreopConsentApi>('/consentCreate', data);
  },
  consentUpdate(data: Record<string, unknown>) {
    return postForm<PreopConsentApi>('/consentUpdate', data);
  },
  consentSubmit(id: number | string) {
    return postForm<PreopConsentApi>('/consentSubmit', { id });
  },
  consentWithdraw(id: number | string) { return postForm<PreopConsentApi>('/consentWithdraw', { id }); },
  consentMarkPrinted(id: number | string) { return postForm<PreopConsentApi>('/consentMarkPrinted', { id }); },
  consentArchive(id: number | string) { return postForm<PreopConsentApi>('/consentArchive', { id }); },

  // ---- 同意书签署流程 ----
  consentPrepareSigning(data: { id: number | string; signingMode?: string; representativeReason?: string }) {
    return postForm<PreopConsentApi & { documentId?: string; contentHash?: string }>('/consentPrepareSigning', data);
  },
  consentAttachHandwrittenSignature(data: {
    id: number | string;
    documentId?: string;
    signerRole: string;
    attachmentId: string;
    attachmentHash: string;
    relationship?: string;
    witnessId?: string;
  }) {
    return postForm<unknown>('/consentAttachHandwrittenSignature', data);
  },
  consentAttachDoctorSignature(data: { id: number | string; documentId?: string; signerGh: string }) {
    return postForm<unknown>('/consentAttachDoctorSignature', data);
  },

  // ---- 安全核查 ----
  safetyCheckList(params: SafetyCheckListQuery = {}) {
    return samisRequest<unknown>(
      `/preoperative/safetyCheckList${buildSafetyCheckListQuery(params)}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  safetyCheckGetById(id: number | string) {
    return samisRequest<unknown>(
      `/preoperative/safetyCheckGetById?id=${encodeURIComponent(String(id))}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  safetyCheckGetByCaseId(caseId: string) {
    return samisRequest<unknown>(
      `/preoperative/safetyCheckGetByCaseId?caseId=${encodeURIComponent(caseId)}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  safetyCheckCreate(data: Record<string, unknown>) {
    return postForm<PreopSafetyCheckApi>('/safetyCheckCreate', data);
  },
  safetyCheckUpdate(data: Record<string, unknown>) {
    return postForm<PreopSafetyCheckApi>('/safetyCheckUpdate', data);
  },
  safetyCheckSummary(operationId: string) {
    return samisRequest<unknown>(
      `/preoperative/safetyCheckSummary?operationId=${encodeURIComponent(operationId)}`,
      undefined,
      { module: 'preoperative' },
    );
  },
  safetyConfirmRole(data: { operationId: string; stage: string; confirmed: boolean; reason?: string }) {
    return postForm<unknown>('/safetyConfirmRole', data);
  },

};

// P07 五流程扩展 API
export interface PreopRequest {
  id: number;
  operationId: string;
  patientName: string | null;
  department: string | null;
  surgeryName: string | null;
  surgeon: string | null;
  urgency: string;
  requestDate: string | null;
  status: string;
  receivedAt: string | null;
  receivedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  version: number;
  remark: string | null;
  operationCase?: OperationCase;
}

export interface PreopConsultation {
  id: number;
  operationId: string;
  requestDept: string | null;
  requestContent: string | null;
  consultant: string | null;
  opinion: string | null;
  status: '待会诊' | '已完成' | '已取消';
  requestedAt: string | null;
  plannedAt: string | null;
  consultDate: string | null;
  submittedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  version: number;
  operationCase?: OperationCase;
}

export type PreopExamSource = 'HULI' | 'LIS' | 'PACS' | 'manual';
export interface PreopExamItem {
  id?: number;
  itemId?: string | null;
  sourceType: PreopExamSource;
  sourceSystem?: string | null;
  sourceRef?: string | null;
  recordedBy?: string | null;
  recordedAt?: string | null;
  examType: string;
  itemCode: string;
  itemName: string;
  resultValue?: string | null;
  resultUnit?: string | null;
  referenceRange?: string | null;
  abnormalFlag?: boolean;
  summary?: string | null;
  version?: number;
}

export interface PreopExamReview {
  id: number;
  operationId: string;
  reviewResult: '通过' | '待补检' | '异常';
  reviewer: string | null;
  reviewDate: string | null;
  reviewedAt: string | null;
  version: number;
  items: PreopExamItem[];
  operationCase?: OperationCase;
}

export interface PreopConsent {
  id: number;
  operationId: string;
  templateCode: string | null;
  templateVersion: string | null;
  riskDisclosure: string | null;
  anesthesiaMethod: string | null;
  commonRisks: boolean;
  severeRisks: boolean;
  specialRisks: boolean;
  planAccepted: boolean;
  questionAnswered: boolean;
  status: '草稿' | '待签署' | '已提交';
  printStatus: string;
  archiveStatus: string;
  signedAt: string | null;
  withdrawnAt: string | null;
  printedAt: string | null;
  archivedAt: string | null;
  version: number;
  operationCase?: OperationCase;
}

export interface PreopSafetyStage {
  code: 'sign_in' | 'time_out' | 'sign_out';
  status: string;
  items: Array<{ code: string; label: string; checked: boolean; value: string | null }>;
  roles: Record<string, { confirmed: boolean; staffGh: string | null; confirmedAt: string | null }>;
  exceptions: string[];
}

export interface PreopSafetySummary {
  operationId: string;
  status: 'missing' | 'incomplete' | 'completed' | 'exception';
  source: 'huli';
  sourceTable: 'security';
  sourceRecordId: string | null;
  updatedAt: string | null;
  stages: PreopSafetyStage[] | null;
}

function p07Post<T>(path: string, data: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    normalized[key] = Array.isArray(value) || (value && typeof value === 'object') ? JSON.stringify(value) : value;
  });
  return samisRequest<T>(`/preoperative/${path}`, buildFormPost(flatFormFieldsFromRecord(normalized)), { module: 'preoperative' });
}

export const preoperativeFiveFlowsApi = {
  requestList(params: Record<string, unknown> = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) query.set(k, String(v)); });
    const q = query.toString();
    return samisRequest<{ list: PreopRequest[]; total?: number }>(`/preoperative/requestList${q ? '?' + q : ''}`, undefined, { module: 'preoperative' });
  },
  requestReceive(data: Record<string, unknown>) { return p07Post<PreopRequest>('requestReceive', data); },
  requestCancel(data: Record<string, unknown>) { return p07Post<PreopRequest>('requestCancel', data); },
  consultationList(params: Record<string, unknown> = {}) {
    const query = new URLSearchParams(); Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null) query.set(k, String(v)); });
    return samisRequest<{ list: PreopConsultation[]; total?: number }>(`/preoperative/consultationList${query.size ? '?' + query : ''}`, undefined, { module: 'preoperative' });
  },
  consultationCreate(data: Record<string, unknown>) { return p07Post<PreopConsultation>('consultationCreate', data); },
  consultationUpdate(data: Record<string, unknown>) { return p07Post<PreopConsultation>('consultationUpdate', data); },
  consultationSubmit(data: Record<string, unknown>) { return p07Post<PreopConsultation>('consultationSubmit', data); },
  consultationCancel(data: Record<string, unknown>) { return p07Post<PreopConsultation>('consultationCancel', data); },
  examReviewList(params: Record<string, unknown> = {}) {
    const query = new URLSearchParams(); Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null) query.set(k, String(v)); });
    return samisRequest<{ list: PreopExamReview[]; total?: number }>(`/preoperative/examReviewList${query.size ? '?' + query : ''}`, undefined, { module: 'preoperative' });
  },
  examReviewCreate(data: Record<string, unknown>) { return p07Post<PreopExamReview>('examReviewCreate', data); },
  examReviewUpdate(data: Record<string, unknown>) { return p07Post<PreopExamReview>('examReviewUpdate', data); },
  consentGetByCaseId(operationId: string) { return samisRequest<PreopConsent | null>(`/preoperative/consentGetByCaseId?caseId=${encodeURIComponent(operationId)}`, undefined, { module: 'preoperative' }); },
  consentCreate(data: Record<string, unknown>) { return p07Post<PreopConsent>('consentCreate', data); },
  consentUpdate(data: Record<string, unknown>) { return p07Post<PreopConsent>('consentUpdate', data); },
  consentPrepareSigning(data: Record<string, unknown>) { return p07Post<PreopConsent>('consentPrepareSigning', data); },
  consentSubmit(data: Record<string, unknown>) { return p07Post<PreopConsent>('consentSubmit', data); },
  consentWithdraw(data: Record<string, unknown>) { return p07Post<PreopConsent>('consentWithdraw', data); },
  consentMarkPrinted(data: Record<string, unknown>) { return p07Post<PreopConsent>('consentMarkPrinted', data); },
  consentArchive(data: Record<string, unknown>) { return p07Post<PreopConsent>('consentArchive', data); },
  safetyCheckSummary(operationId: string) {
    return samisRequest<PreopSafetySummary>(`/preoperative/safetyCheckSummary?operationId=${encodeURIComponent(operationId)}`, undefined, { module: 'preoperative' });
  },
  safetyConfirmRole(data: Record<string, unknown>) {
    return samisRequest<{ status?: string }>(`/preoperative/safetyConfirmRole`, buildFormPost(flatFormFieldsFromRecord(data)), { module: 'preoperative' });
  },
};

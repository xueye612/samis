import { samisRequest } from '@/api/samisClient';
import { buildFormPost, flatFormFieldsFromRecord } from '@/api/samisFormBody';

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

export const preoperativeApi = {
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
};

import { samisRequest } from '@/api/samisClient';
import { buildFormPost, flatFormFieldsFromRecord } from '@/api/samisFormBody';

/** 后端 anes_post_followup 行（camelCase，由 PostFollowupService.formatItem 输出） */
export interface PostFollowupApi {
  id: number;
  caseId: string;
  operationId?: string | null;
  patientName: string;
  followupType: string;
  followTime: string;
  vasScore?: number | null;
  nausea: boolean;
  headache: boolean;
  hoarseness: boolean;
  hoarsenessDurationHours?: number | null;
  numbness: boolean;
  motorDisorder: boolean;
  awareness: boolean;
  respiratoryDepression: boolean;
  reintubation: boolean;
  transferredIcu: boolean;
  newComa: boolean;
  neuroDurationHours?: number | null;
  death24h: boolean;
  deathTime?: string | null;
  advice?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** 后端 anes_post_complication 行（camelCase，由 PostComplicationService.formatItem 输出） */
export interface PostComplicationApi {
  id: number;
  caseId: string;
  operationId?: string | null;
  patientName: string;
  type: string;
  severity: string;
  stage?: string | null;
  symptoms?: string | null;
  treatment?: string | null;
  outcome?: string | null;
  reportTime: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** 镇痛/非计划病例聚合行（PostAggregateService.formatCaseSummary） */
export interface PostCaseSummaryApi {
  operationId: string;
  caseId: string;
  patientName: string;
  gender?: string | null;
  age?: number | null;
  department?: string | null;
  diagnosis?: string | null;
  surgeryName?: string | null;
  surgeon?: string | null;
  anesthesiaMethod?: string | null;
  room?: string | null;
  recordStatus?: string | null;
  postoperativeAnalgesia: boolean;
  transferIcuPlanned: boolean;
  reintubation: boolean;
  transferTo?: string | null;
  recordEndTime?: string | null;
}

export interface FollowupListQuery {
  caseId?: string;
  followupType?: string;
  followTimeStart?: string;
  followTimeEnd?: string;
  page?: number;
  pageSize?: number;
}

export interface ComplicationListQuery {
  caseId?: string;
  status?: string;
  complicationType?: string;
  reportTimeStart?: string;
  reportTimeEnd?: string;
  page?: number;
  pageSize?: number;
}

export interface CaseAggregateQuery {
  room?: string;
  page?: number;
  pageSize?: number;
}

export type PostoperativeFollowupStatus = 'draft' | 'submitted' | 'cancelled';
export interface PostoperativeFollowupContract {
  operationId: string; followupId: string; status: PostoperativeFollowupStatus;
  followupAt?: string | null; followupMethod?: string | null; painScore?: number | null;
  nauseaVomiting: boolean; soreThroat: boolean; awareness: boolean; satisfaction?: number | null;
  analgesiaPlan?: string | null; notes?: string | null; evaluatorId?: string | null; evaluatorName?: string | null;
}
export type PostoperativeComplicationStatus = 'draft' | 'reported' | 'voided';
export interface PostoperativeComplicationContract {
  operationId: string; complicationId: string; complicationType: string; severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
  occurredAt?: string | null; description?: string | null; treatment?: string | null; outcome?: string | null;
  reportStatus: PostoperativeComplicationStatus; reporterId?: string | null; reporterName?: string | null; voidReason?: string | null;
}
export interface PostoperativeDetailApi {
  operationCase: Record<string, unknown>; followup: PostoperativeFollowupContract | null;
  complications: PostoperativeComplicationContract[]; nursingVisitSummary?: Record<string, unknown> | null;
}

function buildFollowupListQuery(params: FollowupListQuery = {}): string {
  const query = new URLSearchParams();
  if (params.caseId) query.set('caseId', params.caseId);
  if (params.followupType) query.set('followupType', params.followupType);
  if (params.followTimeStart) query.set('followTimeStart', params.followTimeStart);
  if (params.followTimeEnd) query.set('followTimeEnd', params.followTimeEnd);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('page_size', String(params.pageSize));
  const text = query.toString();
  return text ? `?${text}` : '';
}

function buildComplicationListQuery(params: ComplicationListQuery = {}): string {
  const query = new URLSearchParams();
  if (params.caseId) query.set('caseId', params.caseId);
  if (params.status) query.set('status', params.status);
  if (params.complicationType) query.set('complicationType', params.complicationType);
  if (params.reportTimeStart) query.set('reportTimeStart', params.reportTimeStart);
  if (params.reportTimeEnd) query.set('reportTimeEnd', params.reportTimeEnd);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('page_size', String(params.pageSize));
  const text = query.toString();
  return text ? `?${text}` : '';
}

function buildAggregateQuery(params: CaseAggregateQuery = {}): string {
  const query = new URLSearchParams();
  if (params.room) query.set('room', params.room);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('page_size', String(params.pageSize));
  const text = query.toString();
  return text ? `?${text}` : '';
}

function postForm<T>(path: string, data: Record<string, unknown>) {
  return samisRequest<T>(`/postoperative${path}`, buildFormPost(flatFormFieldsFromRecord(data)), {
    module: 'postoperative',
  });
}

export const postoperativeApi = {
  followupDetail(operationId: string) {
    return samisRequest<PostoperativeDetailApi>(`/postoperative/followupDetail?operationId=${encodeURIComponent(operationId)}`, undefined, { module: 'postoperative' });
  },
  followupSaveDraft(data: Record<string, unknown>) { return postForm<PostoperativeDetailApi>('/followupSaveDraft', data); },
  followupSubmit(operationId: string) { return postForm<PostoperativeDetailApi>('/followupSubmit', { operationId }); },
  followupCancelSubmit(operationId: string) { return postForm<PostoperativeDetailApi>('/followupCancelSubmit', { operationId }); },
  complicationSave(data: Record<string, unknown>) { return postForm<PostoperativeDetailApi>('/complicationSave', data); },
  complicationVoid(operationId: string, complicationId: string, voidReason?: string) { return postForm<PostoperativeDetailApi>('/complicationVoid', { operationId, complicationId, voidReason }); },
  // ---- 术后随访 ----
  followupList(params: FollowupListQuery = {}) {
    return samisRequest<unknown>(
      `/postoperative/followupList${buildFollowupListQuery(params)}`,
      undefined,
      { module: 'postoperative' },
    );
  },
  followupGetById(id: number | string) {
    return samisRequest<unknown>(
      `/postoperative/followupGetById?id=${encodeURIComponent(String(id))}`,
      undefined,
      { module: 'postoperative' },
    );
  },
  followupCreate(data: Record<string, unknown>) {
    return postForm<PostFollowupApi>('/followupCreate', data);
  },
  followupUpdate(data: Record<string, unknown>) {
    return postForm<PostFollowupApi>('/followupUpdate', data);
  },
  followupDelete(id: number | string) {
    return postForm<{ id: number }>('/followupDelete', { id });
  },

  // ---- 并发症上报 ----
  complicationList(params: ComplicationListQuery = {}) {
    return samisRequest<unknown>(
      `/postoperative/complicationList${buildComplicationListQuery(params)}`,
      undefined,
      { module: 'postoperative' },
    );
  },
  complicationGetById(id: number | string) {
    return samisRequest<unknown>(
      `/postoperative/complicationGetById?id=${encodeURIComponent(String(id))}`,
      undefined,
      { module: 'postoperative' },
    );
  },
  complicationCreate(data: Record<string, unknown>) {
    return postForm<PostComplicationApi>('/complicationCreate', data);
  },
  complicationUpdate(data: Record<string, unknown>) {
    return postForm<PostComplicationApi>('/complicationUpdate', data);
  },
  complicationDelete(id: number | string) {
    return postForm<{ id: number }>('/complicationDelete', { id });
  },

  // ---- 聚合读 ----
  analgesiaCases(params: CaseAggregateQuery = {}) {
    return samisRequest<unknown>(
      `/postoperative/analgesiaCases${buildAggregateQuery(params)}`,
      undefined,
      { module: 'postoperative' },
    );
  },
  unplannedCases(params: CaseAggregateQuery = {}) {
    return samisRequest<unknown>(
      `/postoperative/unplannedCases${buildAggregateQuery(params)}`,
      undefined,
      { module: 'postoperative' },
    );
  },
};

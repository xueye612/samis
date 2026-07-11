import { samisRequest } from '@/api/samisClient';
import { buildFormPost, flatFormFieldsFromRecord } from '@/api/samisFormBody';
import type { QualityCategory } from '@/types/quality';

/** 质控过滤参数（与后端 QualityService filter 对齐）。 */
export interface QualityFilterQuery {
  startMonth?: string;
  endMonth?: string;
  startDate?: string;
  endDate?: string;
  doctorId?: string;
  department?: string;
  locationType?: string;
  roomId?: string;
  category?: QualityCategory | '全部';
}

/** 后端 QualityIndicatorConfig + Calculator 输出行。 */
export interface QualityIndicatorApi {
  code: string;
  name: string;
  category: QualityCategory;
  unit: 'ratio' | 'count' | '%' | '‰';
  numerator: number;
  denominator: number;
  /** 率值（数字；ratio/count 同 value） */
  rate: number | string;
  value: number | string;
  expression: string;
  displayValue: string;
  target: string | null;
  warningRule: { operator: '<' | '>' | '<=' | '>='; value: number } | null;
  met: boolean;
  status: 'normal' | 'warning' | 'abnormal' | 'no-data';
}

export interface QualityCaseSummaryApi {
  caseId: string;
  patientName: string;
  room: string;
  department: string;
  operationName: string;
  anesthesiaMethod: string;
  doctorName: string;
  status: string;
  defectDesc?: string | null;
}

export interface QualityIndicatorDetailApi extends QualityIndicatorApi {
  numeratorCases: QualityCaseSummaryApi[];
  denominatorCases: QualityCaseSummaryApi[];
  defectCases: QualityCaseSummaryApi[];
  totals: { numeratorCount: number; denominatorCount: number };
}

export interface QualityReportIndicatorApi {
  code: string;
  name: string;
  category: QualityCategory;
  unit: 'ratio' | 'count' | '%' | '‰';
  numerator: number;
  denominator: number;
  rate: number | string;
  displayValue: string;
  status: 'normal' | 'warning' | 'abnormal' | 'no-data';
}

export interface QualityReportPeriodApi {
  month: string;
  indicators: QualityReportIndicatorApi[];
  categorySubtotals: Array<{ category: QualityCategory; total: number; withData: number; met: number }>;
}

export interface QualityReportApi {
  periods: QualityReportPeriodApi[];
  months: string[];
}

// ===== Slice 6c B：质控专项聚合 + 抽查 =====

export interface QualityHypothermiaEvidenceApi {
  source: 'event' | 'vital_temp' | 'pacu_first_temp';
  type?: string;
  values?: number[];
  min?: number;
  value?: number;
}

export interface QualityHypothermiaCaseApi {
  caseId: string;
  patientName: string;
  room: string;
  department: string;
  operationName: string;
  anesthesiaMethod: string;
  doctorName: string;
  isGeneralAnesthesia: boolean;
  evidence: QualityHypothermiaEvidenceApi[];
}

export interface QualityHypothermiaResultApi {
  total: number;
  list: QualityHypothermiaCaseApi[];
}

export interface QualityAdverseEventApi {
  id: number;
  caseId: string;
  patientName: string;
  room: string;
  department: string;
  operationName: string;
  type: string;
  name?: string;
  stage?: string;
  severity?: string;
  treatment?: string;
  description?: string;
  reviewStatus?: string;
  eventTime?: string | null;
}

export interface QualityAdverseEventResultApi {
  total: number;
  list: QualityAdverseEventApi[];
}

export type QualityCheckResultApi = '合格' | '不合格' | '待查';
export type QualityRectifyStatusApi = '待整改' | '整改中' | '已闭环';

export interface QualityCheckApi {
  id: number;
  checkItem: string;
  standard?: string | null;
  result: QualityCheckResultApi;
  checker?: string | null;
  checkDate?: string | null;
  issueDesc?: string | null;
  rectifyStatus: QualityRectifyStatusApi;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface QualityCheckListApi {
  list: QualityCheckApi[];
  page: number;
  page_size: number;
  total: number;
}

export interface QualityCheckListQuery {
  result?: QualityCheckResultApi;
  rectifyStatus?: QualityRectifyStatusApi;
  checkItem?: string;
  page?: number;
  pageSize?: number;
}

export type IndicatorCaseStatus = 'pass' | 'warn' | 'fail' | 'not_applicable';
export interface IndicatorResultApi { indicatorCode: string; indicatorName: string; status: IndicatorCaseStatus; severity: string; sourceModule: string; sourceRecordId: string | null; message: string; occurredAt: string | null; }
export interface QualityOperationCaseApi { operationId: string; patientName?: string | null; departmentName?: string | null; operationName?: string | null; anesthesiologistName?: string | null; [key: string]: unknown; }
export interface QualityDrilldownCaseApi { operationId: string; operationCase: QualityOperationCaseApi; riskLevel: string; indicatorResults: IndicatorResultApi[]; defectCount: number; latestDefectStatus: string | null; moduleSummaries?: Record<string, unknown>; }
export interface QualityCaseListApi { list: QualityDrilldownCaseApi[]; total: number; }
export interface DefectRecordApi { defectId: string; operationId: string; indicatorCode: string; severity: string; description: string; owner: string | null; status: 'open'|'rectifying'|'resolved'|'closed'; rectification: string | null; reviewedBy: string | null; reviewedAt: string | null; }
export interface DefectListApi { list: DefectRecordApi[]; total: number; page: number; pageSize: number; }

function buildQuery(params: QualityFilterQuery = {}): string {
  const query = new URLSearchParams();
  if (params.startMonth) query.set('startMonth', params.startMonth);
  if (params.endMonth) query.set('endMonth', params.endMonth);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.doctorId) query.set('doctorId', params.doctorId);
  if (params.department) query.set('department', params.department);
  if (params.locationType) query.set('locationType', params.locationType);
  if (params.roomId) query.set('roomId', params.roomId);
  if (params.category) query.set('category', params.category);
  const text = query.toString();
  return text ? `?${text}` : '';
}

export const qualityApi = {
  caseList(params: Record<string, string | number | undefined> = {}) {
    const q = new URLSearchParams(); Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== '') q.set(k,String(v)); });
    return samisRequest<QualityCaseListApi>(`/quality/caseList${q.size ? `?${q}` : ''}`, { method:'GET' }, { module:'quality' });
  },
  caseDetail(operationId: string) { return samisRequest<QualityDrilldownCaseApi>(`/quality/caseDetail?operationId=${encodeURIComponent(operationId)}`, { method:'GET' }, { module:'quality' }); },
  indicatorSummary(params: Record<string, string | number | undefined> = {}) { const q=new URLSearchParams();Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!=='')q.set(k,String(v));});return samisRequest<Array<Record<string,unknown>>>(`/quality/indicatorSummary${q.size?`?${q}`:''}`,{method:'GET'},{module:'quality'}); },
  defectCreate(data: Record<string, unknown>) { return samisRequest<DefectRecordApi>('/quality/defectCreate', buildFormPost(flatFormFieldsFromRecord(data)), { module:'quality' }); },
  defectUpdate(data: Record<string, unknown>) { return samisRequest<DefectRecordApi>('/quality/defectUpdate', buildFormPost(flatFormFieldsFromRecord(data)), { module:'quality' }); },
  defectClose(data: Record<string, unknown>) { return samisRequest<DefectRecordApi>('/quality/defectClose', buildFormPost(flatFormFieldsFromRecord(data)), { module:'quality' }); },
  defectList(params: Record<string, string | number | undefined> = {}) { const q=new URLSearchParams();Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!=='')q.set(k,String(v));});return samisRequest<DefectListApi>(`/quality/defectList${q.size?`?${q}`:''}`,{method:'GET'},{module:'quality'}); },
  defectDetail(defectId: string) { return samisRequest<DefectRecordApi>(`/quality/defectDetail?defectId=${encodeURIComponent(defectId)}`,{method:'GET'},{module:'quality'}); },
  defectsByOperationId(operationId: string) { return samisRequest<DefectRecordApi[]>(`/quality/defectsByOperationId?operationId=${encodeURIComponent(operationId)}`,{method:'GET'},{module:'quality'}); },
  /** 26 指标列表（rate/target/met/status）。 */
  getIndicators(params: QualityFilterQuery = {}) {
    return samisRequest<QualityIndicatorApi[]>(`/quality/indicators${buildQuery(params)}`, {
      method: 'GET',
    }, { module: 'quality' });
  },

  /** 单指标穿透（分子分母 case 列表）。 */
  getIndicatorDetail(code: string, params: QualityFilterQuery = {}) {
    const query = new URLSearchParams();
    query.set('code', code);
    if (params.startMonth) query.set('startMonth', params.startMonth);
    if (params.endMonth) query.set('endMonth', params.endMonth);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.doctorId) query.set('doctorId', params.doctorId);
    if (params.department) query.set('department', params.department);
    if (params.locationType) query.set('locationType', params.locationType);
    if (params.roomId) query.set('roomId', params.roomId);
    return samisRequest<QualityIndicatorDetailApi>(
      `/quality/indicatorDetail?${query.toString()}`,
      { method: 'GET' },
      { module: 'quality' },
    );
  },

  /** 月度/周期报表。period='YYYY-MM' 或 startMonth~endMonth。 */
  getReport(params: ({ period: string } | { startMonth: string; endMonth: string }) & QualityFilterQuery) {
    const query = new URLSearchParams();
    if ('period' in params && params.period) query.set('period', params.period);
    if ('startMonth' in params && params.startMonth) query.set('startMonth', params.startMonth);
    if ('endMonth' in params && params.endMonth) query.set('endMonth', params.endMonth);
    if (params.doctorId) query.set('doctorId', params.doctorId);
    if (params.department) query.set('department', params.department);
    const text = query.toString();
    return samisRequest<QualityReportApi>(`/quality/report${text ? `?${text}` : ''}`, {
      method: 'GET',
    }, { module: 'quality' });
  },

  /** 低体温病例聚合（event 低体温 ∪ TEMP<36 ∪ pacu first_temp<36）。 */
  getHypothermiaCases(params: QualityFilterQuery = {}) {
    return samisRequest<QualityHypothermiaResultApi>(`/quality/hypothermiaCases${buildQuery(params)}`, {
      method: 'GET',
    }, { module: 'quality' });
  },

  /** 不良事件聚合（12 类 isQualityEvent）。 */
  getAdverseEvents(params: QualityFilterQuery = {}) {
    return samisRequest<QualityAdverseEventResultApi>(`/quality/adverseEvents${buildQuery(params)}`, {
      method: 'GET',
    }, { module: 'quality' });
  },

  /** 抽查记录分页列表。 */
  checkList(params: QualityCheckListQuery = {}) {
    const query = new URLSearchParams();
    if (params.result) query.set('result', params.result);
    if (params.rectifyStatus) query.set('rectifyStatus', params.rectifyStatus);
    if (params.checkItem) query.set('checkItem', params.checkItem);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('page_size', String(params.pageSize));
    const text = query.toString();
    return samisRequest<QualityCheckListApi>(`/quality/checkList${text ? `?${text}` : ''}`, {
      method: 'GET',
    }, { module: 'quality' });
  },
  checkGetById(id: number | string) {
    return samisRequest<QualityCheckApi>(`/quality/checkGetById?id=${encodeURIComponent(String(id))}`, {
      method: 'GET',
    }, { module: 'quality' });
  },
  checkCreate(data: Record<string, unknown>) {
    return samisRequest<{ id: number }>('/quality/checkCreate', buildFormPost(flatFormFieldsFromRecord(data)), { module: 'quality' });
  },
  checkUpdate(data: Record<string, unknown>) {
    return samisRequest<void>('/quality/checkUpdate', buildFormPost(flatFormFieldsFromRecord(data)), { module: 'quality' });
  },
  checkDelete(id: number | string) {
    return samisRequest<void>('/quality/checkDelete', buildFormPost({ id: String(id) }), { module: 'quality' });
  },
};

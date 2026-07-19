import { Message } from '@arco-design/web-vue';
import { preoperativeApi } from '@/api/preoperative';
import { notifyIfUnhandledSamisError } from '@/services/auth/authErrorPresentation';
import { useRealPreoperative } from '@/config/apiFlags';
import { SamisHttpError } from '@/api/samisHttpClient';
import { isSamisLoggedIn } from '@/services/session/samisSession';
import type {
  SurgeryRequest,
  ConsultationRecord,
  ExamReviewRecord,
  ConsentRecord,
  SafetyCheckRecord,
} from '@/types/clinicalModules';
import type {
  PreopRequestApi,
  PreopConsultationApi,
  PreopExamReviewApi,
  PreopConsentApi,
  PreopSafetyCheckApi,
} from '@/api/preoperative';

export interface PreopListState<T> {
  list: T[];
  total: number;
  source: 'remote' | 'mock';
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof SamisHttpError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

const VALID_URGENCY = ['急诊', '择期'] as const;
const VALID_REQUEST_STATUS = ['待接收', '已排班', '已取消'] as const;
const VALID_CONSULT_STATUS = ['待会诊', '已完成', '已取消'] as const;
const VALID_REVIEW_RESULT = ['通过', '待补检', '异常'] as const;
const VALID_CONSENT_STATUS = ['草稿', '已提交'] as const;
const VALID_CHECK_STATUS = ['未完成', '已完成'] as const;

export class PreopRequestReadOnlyError extends Error {
  constructor(message = '手术通知由护理系统维护，麻醉系统仅提供只读查看') {
    super(message);
    this.name = 'PreopRequestReadOnlyError';
  }
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value as string) ? (value as T) : fallback;
}

// ===================== request =====================

/** 后端 request 行 → 前端 SurgeryRequest（id 为数值字符串；operationId 不在类型内，create 时单独传） */
export function mapRequestApiToRequest(row: PreopRequestApi): SurgeryRequest {
  const isReadOnly = row.readOnly === true || row.sourceSystem === 'HULI';
  return {
    id: String(row.id),
    operationId: row.operationId,
    patientName: row.patientName ?? '',
    department: row.department ?? '',
    surgeryName: row.surgeryName ?? '',
    urgency: isReadOnly && row.urgency == null ? null : pickEnum(row.urgency, VALID_URGENCY, '择期'),
    requestDate: row.requestDate ?? '',
    status: isReadOnly && row.status == null ? null : pickEnum(row.status, VALID_REQUEST_STATUS, '待接收'),
    surgeon: row.surgeon ?? '',
    operationStatus: row.operationStatus ?? row.operationCase?.status ?? null,
    readOnly: isReadOnly,
    sourceSystem: row.sourceSystem ?? null,
  };
}

/** 前端 SurgeryRequest → 后端 request payload（create 需 operationId，单独传） */
export function buildRequestPayload(
  request: Partial<SurgeryRequest>,
  operationId?: string,
): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (operationId) payload.operationId = operationId;
  if (request.patientName !== undefined) payload.patientName = request.patientName;
  if (request.department !== undefined) payload.department = request.department;
  if (request.surgeryName !== undefined) payload.surgeryName = request.surgeryName;
  if (request.surgeon !== undefined) payload.surgeon = request.surgeon;
  if (request.urgency !== undefined && request.urgency !== null) payload.urgency = request.urgency;
  if (request.requestDate !== undefined) payload.requestDate = request.requestDate;
  if (request.status !== undefined && request.status !== null) payload.status = request.status;
  return payload;
}

export async function loadRemoteRequests(params?: {
  status?: string;
  urgency?: string;
  department?: string;
}): Promise<PreopListState<SurgeryRequest>> {
  const query = {
    status: params?.status,
    urgency: params?.urgency,
    department: params?.department,
    page: 1,
    pageSize: 200,
  };

  if (!useRealPreoperative()) {
    const { list, total } = extractList(await preoperativeApi.requestList(query));
    return { list: (list as PreopRequestApi[]).map(mapRequestApiToRequest), total, source: 'mock' };
  }

  if (!isSamisLoggedIn()) {
    return { list: [], total: 0, source: 'mock' };
  }

  try {
    const { list, total } = extractList(await preoperativeApi.requestList(query));
    return { list: (list as PreopRequestApi[]).map(mapRequestApiToRequest), total, source: 'remote' };
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载手术申请失败')}，已使用本地数据`));
    return { list: [], total: 0, source: 'mock' };
  }
}

/** 新增/更新申请（真实开关开→调 api 返回最新行；关→返回 null 由 store 本地处理）。 */
export async function upsertRequestRemote(
  request: SurgeryRequest,
  operationId?: string,
): Promise<SurgeryRequest | null> {
  void request;
  void operationId;
  throw new PreopRequestReadOnlyError();
}

/** 接收申请（真实开关开+已登录才调）。 */
export async function receiveRequestRemote(id: string | number): Promise<void> {
  void id;
  throw new PreopRequestReadOnlyError();
}

/** 取消申请（真实开关开+已登录才调）。 */
export async function cancelRequestRemote(id: string | number): Promise<void> {
  void id;
  throw new PreopRequestReadOnlyError();
}

// ===================== consultation =====================

export function mapConsultationApiToRecord(row: PreopConsultationApi): ConsultationRecord {
  return {
    id: String(row.id),
    caseId: row.caseId,
    patientName: row.operationCase?.patientName ?? row.patientName ?? '',
    requestDept: row.requestDept ?? row.operationCase?.departmentName ?? '',
    consultDate: row.consultDate ?? '',
    consultant: row.consultant ?? '',
    opinion: row.opinion ?? '',
    status: pickEnum(row.status, VALID_CONSULT_STATUS, '待会诊'),
    requestContent: row.requestContent ?? '',
    consultantId: row.consultantId ?? '',
    submittedAt: row.submittedAt ?? undefined,
    cancelledAt: row.cancelledAt ?? undefined,
    cancelReason: row.cancelReason ?? '',
  };
}

export function buildConsultationPayload(
  record: Partial<ConsultationRecord>,
): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (record.caseId !== undefined) payload.operationId = record.caseId;
  if (record.requestDept !== undefined) payload.requestDept = record.requestDept;
  if (record.consultDate !== undefined) payload.consultDate = record.consultDate;
  if (record.consultant !== undefined) payload.consultant = record.consultant;
  if (record.requestContent !== undefined) payload.requestContent = record.requestContent;
  if (record.consultantId !== undefined) payload.consultantId = record.consultantId;
  if (record.opinion !== undefined) payload.opinion = record.opinion;
  return payload;
}

export async function loadRemoteConsultations(params?: {
  caseId?: string;
  status?: string;
}): Promise<PreopListState<ConsultationRecord>> {
  const query = { caseId: params?.caseId, status: params?.status, page: 1, pageSize: 200 };

  if (!useRealPreoperative()) {
    const { list, total } = extractList(await preoperativeApi.consultationList(query));
    return { list: (list as PreopConsultationApi[]).map(mapConsultationApiToRecord), total, source: 'mock' };
  }
  if (!isSamisLoggedIn()) {
    return { list: [], total: 0, source: 'mock' };
  }
  try {
    const { list, total } = extractList(await preoperativeApi.consultationList(query));
    return { list: (list as PreopConsultationApi[]).map(mapConsultationApiToRecord), total, source: 'remote' };
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载会诊列表失败')}，已使用本地数据`));
    return { list: [], total: 0, source: 'mock' };
  }
}

export async function upsertConsultationRemote(
  record: ConsultationRecord,
): Promise<ConsultationRecord | null> {
  const payload = buildConsultationPayload(record);
  const isEdit = /^\d+$/.test(record.id);
  if (!useRealPreoperative()) {
    if (isEdit) await preoperativeApi.consultationUpdate({ id: Number(record.id), ...payload });
    else await preoperativeApi.consultationCreate(payload);
    return null;
  }
  if (!isSamisLoggedIn()) throw new Error('未登录，无法保存会诊');
  const result = isEdit
    ? await preoperativeApi.consultationUpdate({ id: Number(record.id), ...payload })
    : await preoperativeApi.consultationCreate(payload);
  return mapConsultationApiToRecord(result as PreopConsultationApi);
}

export async function submitConsultationRemote(id: string | number): Promise<ConsultationRecord | null> {
  if (!useRealPreoperative() || !isSamisLoggedIn()) return null;
  return mapConsultationApiToRecord(await preoperativeApi.consultationSubmit(id));
}

export async function cancelConsultationRemote(id: string | number, reason = ''): Promise<ConsultationRecord | null> {
  if (!useRealPreoperative() || !isSamisLoggedIn()) return null;
  return mapConsultationApiToRecord(await preoperativeApi.consultationCancel(id, reason));
}

// ===================== examReview =====================

export function mapExamReviewApiToRecord(row: PreopExamReviewApi): ExamReviewRecord {
  return {
    id: String(row.id),
    caseId: row.caseId,
    patientName: row.patientName ?? '',
    labItems: row.labItems ?? '',
    imagingItems: row.imagingItems ?? '',
    reviewResult: pickEnum(row.reviewResult, VALID_REVIEW_RESULT, '通过'),
    reviewer: row.reviewer ?? '',
    reviewDate: row.reviewDate ?? '',
  };
}

export function buildExamReviewPayload(
  record: Partial<ExamReviewRecord>,
): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (record.caseId !== undefined) payload.caseId = record.caseId;
  if (record.patientName !== undefined) payload.patientName = record.patientName;
  if (record.labItems !== undefined) payload.labItems = record.labItems;
  if (record.imagingItems !== undefined) payload.imagingItems = record.imagingItems;
  if (record.reviewResult !== undefined) payload.reviewResult = record.reviewResult;
  if (record.reviewer !== undefined) payload.reviewer = record.reviewer;
  if (record.reviewDate !== undefined) payload.reviewDate = record.reviewDate;
  return payload;
}

export async function loadRemoteExamReviews(params?: {
  caseId?: string;
  reviewResult?: string;
}): Promise<PreopListState<ExamReviewRecord>> {
  const query = { caseId: params?.caseId, reviewResult: params?.reviewResult, page: 1, pageSize: 200 };

  if (!useRealPreoperative()) {
    const { list, total } = extractList(await preoperativeApi.examReviewList(query));
    return { list: (list as PreopExamReviewApi[]).map(mapExamReviewApiToRecord), total, source: 'mock' };
  }
  if (!isSamisLoggedIn()) {
    return { list: [], total: 0, source: 'mock' };
  }
  try {
    const { list, total } = extractList(await preoperativeApi.examReviewList(query));
    return { list: (list as PreopExamReviewApi[]).map(mapExamReviewApiToRecord), total, source: 'remote' };
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载检查审核失败')}，已使用本地数据`));
    return { list: [], total: 0, source: 'mock' };
  }
}

export async function upsertExamReviewRemote(
  record: ExamReviewRecord,
): Promise<ExamReviewRecord | null> {
  const payload = buildExamReviewPayload(record);
  const isEdit = /^\d+$/.test(record.id);
  if (!useRealPreoperative()) {
    if (isEdit) await preoperativeApi.examReviewUpdate({ id: Number(record.id), ...payload });
    else await preoperativeApi.examReviewCreate(payload);
    return null;
  }
  if (!isSamisLoggedIn()) throw new Error('未登录，无法保存检查审核');
  const result = isEdit
    ? await preoperativeApi.examReviewUpdate({ id: Number(record.id), ...payload })
    : await preoperativeApi.examReviewCreate(payload);
  return mapExamReviewApiToRecord(result as PreopExamReviewApi);
}

// ===================== consent =====================

export function mapConsentApiToRecord(row: PreopConsentApi): ConsentRecord {
  return {
    id: String(row.id),
    caseId: row.caseId,
    patientName: row.operationCase?.patientName ?? row.patientName ?? '',
    surgeryName: row.operationCase?.operationName ?? row.surgeryName ?? '',
    anesthesiaMethod: row.anesthesiaMethod ?? '',
    surgeryDate: row.surgeryDate ?? '',
    commonRisks: Boolean(row.commonRisks),
    severeRisks: Boolean(row.severeRisks),
    specialRisks: Boolean(row.specialRisks),
    planAccepted: Boolean(row.planAccepted),
    questionAnswered: Boolean(row.questionAnswered),
    patientSigned: Boolean(row.patientSigned),
    familySigned: Boolean(row.familySigned),
    doctorSigned: Boolean(row.doctorSigned),
    signedAt: row.signedAt ?? undefined,
    status: pickEnum(row.status, VALID_CONSENT_STATUS, '草稿'),
    updatedAt: row.updatedAt ?? '',
    templateCode: row.templateCode ?? '',
    templateVersion: row.templateVersion ?? '',
    riskDisclosure: row.riskDisclosure ?? '',
    printStatus: row.printStatus === '已打印' ? '已打印' : '未打印',
    archiveStatus: row.archiveStatus === '已归档' ? '已归档' : '未归档',
  };
}

export function buildConsentPayload(
  record: Partial<ConsentRecord>,
): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (record.caseId !== undefined) payload.operationId = record.caseId;
  if (record.anesthesiaMethod !== undefined) payload.anesthesiaMethod = record.anesthesiaMethod;
  if (record.templateCode !== undefined) payload.templateCode = record.templateCode;
  if (record.templateVersion !== undefined) payload.templateVersion = record.templateVersion;
  if (record.riskDisclosure !== undefined) payload.riskDisclosure = record.riskDisclosure;
  const flagMap: Array<[keyof ConsentRecord, string]> = [
    ['commonRisks', 'commonRisks'],
    ['severeRisks', 'severeRisks'],
    ['specialRisks', 'specialRisks'],
    ['planAccepted', 'planAccepted'],
    ['questionAnswered', 'questionAnswered'],
    ['patientSigned', 'patientSigned'],
    ['familySigned', 'familySigned'],
    ['doctorSigned', 'doctorSigned'],
  ];
  for (const [field, key] of flagMap) {
    if (record[field] !== undefined) payload[key] = Boolean(record[field]);
  }
  return payload;
}

export async function loadRemoteConsentRecords(params?: {
  caseId?: string;
  status?: string;
}): Promise<PreopListState<ConsentRecord>> {
  const query = { caseId: params?.caseId, status: params?.status, page: 1, pageSize: 200 };

  if (!useRealPreoperative()) {
    const { list, total } = extractList(await preoperativeApi.consentList(query));
    return { list: (list as PreopConsentApi[]).map(mapConsentApiToRecord), total, source: 'mock' };
  }
  if (!isSamisLoggedIn()) {
    return { list: [], total: 0, source: 'mock' };
  }
  try {
    const { list, total } = extractList(await preoperativeApi.consentList(query));
    return { list: (list as PreopConsentApi[]).map(mapConsentApiToRecord), total, source: 'remote' };
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载知情同意失败')}，已使用本地数据`));
    return { list: [], total: 0, source: 'mock' };
  }
}

/**
 * 按 caseId 取唯一活跃同意书（1:1 首选读）。
 * 真实开关开+已登录→调 api（无则返回 null）；否则返回 null（由调用方走本地 store 派生）。
 */
export async function fetchConsentByCaseId(caseId: string): Promise<ConsentRecord | null> {
  if (!caseId) return null;
  if (!useRealPreoperative() || !isSamisLoggedIn()) return null;
  try {
    const row = (await preoperativeApi.consentGetByCaseId(caseId)) as PreopConsentApi | null;
    return row ? mapConsentApiToRecord(row) : null;
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载知情同意失败')}，已使用本地数据`));
    return null;
  }
}

export async function upsertConsentRemote(record: ConsentRecord): Promise<ConsentRecord | null> {
  const payload = buildConsentPayload(record);
  const isEdit = /^\d+$/.test(record.id);
  if (!useRealPreoperative()) {
    if (isEdit) await preoperativeApi.consentUpdate({ id: Number(record.id), ...payload });
    else await preoperativeApi.consentCreate(payload);
    return null;
  }
  if (!isSamisLoggedIn()) throw new Error('未登录，无法保存知情同意');
  const result = isEdit
    ? await preoperativeApi.consentUpdate({ id: Number(record.id), ...payload })
    : await preoperativeApi.consentCreate(payload);
  return mapConsentApiToRecord(result as PreopConsentApi);
}

/** 提交同意书（真实开关开+已登录才调；返回最新行或 null）。 */
export async function submitConsentRemote(id: string | number): Promise<ConsentRecord | null> {
  if (!useRealPreoperative() || !isSamisLoggedIn()) return null;
  const result = await preoperativeApi.consentSubmit(id);
  return mapConsentApiToRecord(result as PreopConsentApi);
}

export async function withdrawConsentRemote(id: string | number): Promise<ConsentRecord | null> {
  if (!useRealPreoperative() || !isSamisLoggedIn()) return null;
  return mapConsentApiToRecord(await preoperativeApi.consentWithdraw(id));
}

export async function markConsentPrintedRemote(id: string | number): Promise<ConsentRecord | null> {
  if (!useRealPreoperative() || !isSamisLoggedIn()) return null;
  return mapConsentApiToRecord(await preoperativeApi.consentMarkPrinted(id));
}

// ===================== safetyCheck =====================

export function mapSafetyCheckApiToRecord(row: PreopSafetyCheckApi): SafetyCheckRecord {
  return {
    id: String(row.id),
    caseId: row.caseId,
    patientName: row.patientName ?? '',
    signInComplete: Boolean(row.signInComplete),
    timeOutComplete: Boolean(row.timeOutComplete),
    signOutComplete: Boolean(row.signOutComplete),
    checker: row.checker ?? '',
    checkDate: row.checkDate ?? '',
    status: pickEnum(row.status, VALID_CHECK_STATUS, '未完成'),
  };
}

export function buildSafetyCheckPayload(
  record: Partial<SafetyCheckRecord>,
): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (record.caseId !== undefined) payload.caseId = record.caseId;
  if (record.patientName !== undefined) payload.patientName = record.patientName;
  if (record.signInComplete !== undefined) payload.signInComplete = Boolean(record.signInComplete);
  if (record.timeOutComplete !== undefined) payload.timeOutComplete = Boolean(record.timeOutComplete);
  if (record.signOutComplete !== undefined) payload.signOutComplete = Boolean(record.signOutComplete);
  if (record.checker !== undefined) payload.checker = record.checker;
  if (record.checkDate !== undefined) payload.checkDate = record.checkDate;
  return payload;
}

export async function loadRemoteSafetyChecks(params?: {
  caseId?: string;
  status?: string;
}): Promise<PreopListState<SafetyCheckRecord>> {
  const query = { caseId: params?.caseId, status: params?.status, page: 1, pageSize: 200 };

  if (!useRealPreoperative()) {
    const { list, total } = extractList(await preoperativeApi.safetyCheckList(query));
    return { list: (list as PreopSafetyCheckApi[]).map(mapSafetyCheckApiToRecord), total, source: 'mock' };
  }
  if (!isSamisLoggedIn()) {
    return { list: [], total: 0, source: 'mock' };
  }
  try {
    const { list, total } = extractList(await preoperativeApi.safetyCheckList(query));
    return { list: (list as PreopSafetyCheckApi[]).map(mapSafetyCheckApiToRecord), total, source: 'remote' };
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载安全核查失败')}，已使用本地数据`));
    return { list: [], total: 0, source: 'mock' };
  }
}

/**
 * 按 caseId 取唯一活跃核查（1:1 首选读）。真实开关开+已登录→调 api；否则 null。
 */
export async function fetchSafetyCheckByCaseId(caseId: string): Promise<SafetyCheckRecord | null> {
  if (!caseId) return null;
  if (!useRealPreoperative() || !isSamisLoggedIn()) return null;
  try {
    const row = (await preoperativeApi.safetyCheckGetByCaseId(caseId)) as PreopSafetyCheckApi | null;
    return row ? mapSafetyCheckApiToRecord(row) : null;
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载安全核查失败')}，已使用本地数据`));
    return null;
  }
}

export async function upsertSafetyCheckRemote(record: SafetyCheckRecord): Promise<SafetyCheckRecord | null> {
  const payload = buildSafetyCheckPayload(record);
  const isEdit = /^\d+$/.test(record.id);
  if (!useRealPreoperative()) {
    if (isEdit) await preoperativeApi.safetyCheckUpdate({ id: Number(record.id), ...payload });
    else await preoperativeApi.safetyCheckCreate(payload);
    return null;
  }
  if (!isSamisLoggedIn()) throw new Error('未登录，无法保存安全核查');
  const result = isEdit
    ? await preoperativeApi.safetyCheckUpdate({ id: Number(record.id), ...payload })
    : await preoperativeApi.safetyCheckCreate(payload);
  return mapSafetyCheckApiToRecord(result as PreopSafetyCheckApi);
}

// ===================== helpers =====================

function extractList(raw: unknown): { list: unknown[]; total: number } {
  const body = (raw ?? {}) as { list?: unknown; total?: unknown };
  return {
    list: Array.isArray(body.list) ? body.list : [],
    total: typeof body.total === 'number' ? body.total : 0,
  };
}

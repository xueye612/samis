import { Message } from '@arco-design/web-vue';
import { postoperativeApi } from '@/api/postoperative';
import { notifyIfUnhandledSamisError } from '@/services/auth/authErrorPresentation';
import { useRealPostoperative } from '@/config/apiFlags';
import { SamisHttpError } from '@/api/samisHttpClient';
import { isSamisLoggedIn } from '@/services/session/samisSession';
import type { PostoperativeFollowUp } from '@/types/anesthesia';
import type { ComplicationRecord } from '@/types/clinicalModules';
import type { PostFollowupApi, PostComplicationApi, PostCaseSummaryApi } from '@/api/postoperative';

/** 镇痛/非计划聚合后端行 → 前端展示对象（带 id 给表格 row-key 用） */
export interface PostCaseSummary {
  id: string;
  operationId: string;
  caseId: string;
  patientName: string;
  surgeryName?: string | null;
  anesthesiaMethod?: string | null;
  room?: string | null;
  status?: string | null;
  postoperativeAnalgesia: boolean;
  transferIcuPlanned: boolean;
  reintubation: boolean;
  transferTo?: string | null;
  recordEndTime?: string | null;
}

export interface PostListState<T> {
  list: T[];
  total: number;
  source: 'remote' | 'mock';
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof SamisHttpError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

const VALID_FOLLOWUP_TYPES = ['术后镇痛随访', '全麻术后随访', '区域阻滞术后随访'] as const;
const VALID_SEVERITIES = ['轻度', '中度', '重度', '危及生命'] as const;

/** 后端随访行 → 前端 PostoperativeFollowUp（vasScore→vas，death24h→death） */
export function mapFollowupApiToFollowUp(row: PostFollowupApi): PostoperativeFollowUp {
  const type = (VALID_FOLLOWUP_TYPES as readonly string[]).includes(row.followupType)
    ? (row.followupType as PostoperativeFollowUp['type'])
    : '术后镇痛随访';
  return {
    id: String(row.id),
    caseId: row.caseId,
    type,
    followTime: row.followTime,
    vas: row.vasScore ?? 0,
    nausea: Boolean(row.nausea),
    headache: Boolean(row.headache),
    hoarseness: Boolean(row.hoarseness),
    numbness: Boolean(row.numbness),
    motorDisorder: Boolean(row.motorDisorder),
    awareness: Boolean(row.awareness),
    respiratoryDepression: Boolean(row.respiratoryDepression),
    reintubation: Boolean(row.reintubation),
    transferredIcu: Boolean(row.transferredIcu),
    death: Boolean(row.death24h),
    advice: row.advice ?? '',
    newComa: Boolean(row.newComa),
    neuroDurationHours: row.neuroDurationHours ?? undefined,
    hoarsenessDurationHours: row.hoarsenessDurationHours ?? undefined,
  };
}

/** 前端 PostoperativeFollowUp → 后端 create/update payload */
export function buildFollowupPayload(
  followUp: Partial<PostoperativeFollowUp>,
): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (followUp.caseId !== undefined) payload.caseId = followUp.caseId;
  if (followUp.type !== undefined) payload.followupType = followUp.type;
  if (followUp.followTime !== undefined) payload.followTime = followUp.followTime;
  if (followUp.vas !== undefined) payload.vasScore = followUp.vas;
  if (followUp.nausea !== undefined) payload.nausea = followUp.nausea;
  if (followUp.headache !== undefined) payload.headache = followUp.headache;
  if (followUp.hoarseness !== undefined) payload.hoarseness = followUp.hoarseness;
  if (followUp.hoarsenessDurationHours !== undefined) payload.hoarsenessDurationHours = followUp.hoarsenessDurationHours;
  if (followUp.numbness !== undefined) payload.numbness = followUp.numbness;
  if (followUp.motorDisorder !== undefined) payload.motorDisorder = followUp.motorDisorder;
  if (followUp.awareness !== undefined) payload.awareness = followUp.awareness;
  if (followUp.respiratoryDepression !== undefined) payload.respiratoryDepression = followUp.respiratoryDepression;
  if (followUp.reintubation !== undefined) payload.reintubation = followUp.reintubation;
  if (followUp.transferredIcu !== undefined) payload.transferredIcu = followUp.transferredIcu;
  if (followUp.newComa !== undefined) payload.newComa = followUp.newComa;
  if (followUp.neuroDurationHours !== undefined) payload.neuroDurationHours = followUp.neuroDurationHours;
  if (followUp.death !== undefined) payload.death24h = followUp.death;
  if (followUp.advice !== undefined) payload.advice = followUp.advice;
  return payload;
}

/** 后端并发症行 → 前端 ComplicationRecord */
export function mapComplicationApiToRecord(row: PostComplicationApi): ComplicationRecord {
  const severity = ((VALID_SEVERITIES as readonly string[]).includes(row.severity)
    ? row.severity
    : '中度') as ComplicationRecord['severity'];
  const status: ComplicationRecord['status'] = row.status === '已提交' ? '已提交' : '草稿';
  return {
    id: String(row.id),
    caseId: row.caseId,
    patientName: row.patientName ?? '',
    type: row.type,
    severity,
    stage: row.stage ?? '',
    symptoms: row.symptoms ?? '',
    treatment: row.treatment ?? '',
    outcome: row.outcome ?? '',
    reportTime: row.reportTime,
    status,
  };
}

/** 前端 ComplicationRecord → 后端 create/update payload */
export function buildComplicationPayload(
  record: Partial<ComplicationRecord>,
): Record<string, string | number | boolean> {
  const payload: Record<string, string | number | boolean> = {};
  if (record.caseId !== undefined) payload.caseId = record.caseId;
  if (record.patientName !== undefined) payload.patientName = record.patientName;
  if (record.type !== undefined) payload.complicationType = record.type;
  if (record.severity !== undefined) payload.severity = record.severity;
  if (record.stage !== undefined) payload.stage = record.stage;
  if (record.symptoms !== undefined) payload.symptoms = record.symptoms;
  if (record.treatment !== undefined) payload.treatment = record.treatment;
  if (record.outcome !== undefined) payload.outcome = record.outcome;
  if (record.reportTime !== undefined) payload.reportTime = record.reportTime;
  if (record.status !== undefined) payload.status = record.status;
  return payload;
}

export function mapCaseSummaryApiToSummary(row: PostCaseSummaryApi): PostCaseSummary {
  return {
    id: String(row.operationId || row.caseId),
    operationId: row.operationId,
    caseId: row.caseId,
    patientName: row.patientName,
    surgeryName: row.surgeryName,
    anesthesiaMethod: row.anesthesiaMethod,
    room: row.room,
    status: row.recordStatus,
    postoperativeAnalgesia: row.postoperativeAnalgesia,
    transferIcuPlanned: row.transferIcuPlanned,
    reintubation: row.reintubation,
    transferTo: row.transferTo,
    recordEndTime: row.recordEndTime,
  };
}

function extractList(raw: unknown): { list: unknown[]; total: number } {
  const body = (raw ?? {}) as { list?: unknown; total?: unknown };
  return {
    list: Array.isArray(body.list) ? body.list : [],
    total: typeof body.total === 'number' ? body.total : 0,
  };
}

/** 加载术后随访列表（真实开关开→调 api；失败回落 mock）。 */
export async function loadRemoteFollowups(params?: {
  caseId?: string;
  followupType?: string;
}): Promise<PostListState<PostoperativeFollowUp>> {
  const query = {
    caseId: params?.caseId,
    followupType: params?.followupType,
    page: 1,
    pageSize: 200,
  };

  if (!useRealPostoperative()) {
    const { list, total } = extractList(await postoperativeApi.followupList(query));
    return { list: (list as PostFollowupApi[]).map(mapFollowupApiToFollowUp), total, source: 'mock' };
  }

  if (!isSamisLoggedIn()) {
    return { list: [], total: 0, source: 'mock' };
  }

  try {
    const { list, total } = extractList(await postoperativeApi.followupList(query));
    return { list: (list as PostFollowupApi[]).map(mapFollowupApiToFollowUp), total, source: 'remote' };
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载术后随访失败')}，已使用本地数据`));
    return { list: [], total: 0, source: 'mock' };
  }
}

/** 新增/更新随访（真实开关开→调 api 返回最新行；关→返回 null 由 store 本地处理）。 */
export async function upsertFollowupRemote(
  followUp: PostoperativeFollowUp,
): Promise<PostoperativeFollowUp | null> {
  const payload = buildFollowupPayload(followUp);
  const isEdit = /^\d+$/.test(followUp.id);
  if (!useRealPostoperative()) {
    if (isEdit) await postoperativeApi.followupUpdate({ id: Number(followUp.id), ...payload });
    else await postoperativeApi.followupCreate(payload);
    return null;
  }
  if (!isSamisLoggedIn()) throw new Error('未登录，无法保存术后随访');
  const result = isEdit
    ? await postoperativeApi.followupUpdate({ id: Number(followUp.id), ...payload })
    : await postoperativeApi.followupCreate(payload);
  return mapFollowupApiToFollowUp(result as PostFollowupApi);
}

/** 删除随访（真实开关开→调 api）。 */
export async function deleteFollowupRemote(id: string | number): Promise<void> {
  if (!useRealPostoperative() || !isSamisLoggedIn()) {
    if (!useRealPostoperative()) await postoperativeApi.followupDelete(id);
    return;
  }
  await postoperativeApi.followupDelete(id);
}

/** 加载并发症列表（真实开关开→调 api；失败回落 mock）。 */
export async function loadRemoteComplications(params?: {
  caseId?: string;
  status?: string;
  complicationType?: string;
}): Promise<PostListState<ComplicationRecord>> {
  const query = {
    caseId: params?.caseId,
    status: params?.status,
    complicationType: params?.complicationType,
    page: 1,
    pageSize: 200,
  };

  if (!useRealPostoperative()) {
    const { list, total } = extractList(await postoperativeApi.complicationList(query));
    return { list: (list as PostComplicationApi[]).map(mapComplicationApiToRecord), total, source: 'mock' };
  }

  if (!isSamisLoggedIn()) {
    return { list: [], total: 0, source: 'mock' };
  }

  try {
    const { list, total } = extractList(await postoperativeApi.complicationList(query));
    return { list: (list as PostComplicationApi[]).map(mapComplicationApiToRecord), total, source: 'remote' };
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载并发症列表失败')}，已使用本地数据`));
    return { list: [], total: 0, source: 'mock' };
  }
}

/** 新增/更新并发症（真实开关开→调 api 返回最新行；关→返回 null）。 */
export async function upsertComplicationRemote(
  record: ComplicationRecord,
): Promise<ComplicationRecord | null> {
  const payload = buildComplicationPayload(record);
  const isEdit = /^\d+$/.test(record.id);
  if (!useRealPostoperative()) {
    if (isEdit) await postoperativeApi.complicationUpdate({ id: Number(record.id), ...payload });
    else await postoperativeApi.complicationCreate(payload);
    return null;
  }
  if (!isSamisLoggedIn()) throw new Error('未登录，无法保存并发症');
  const result = isEdit
    ? await postoperativeApi.complicationUpdate({ id: Number(record.id), ...payload })
    : await postoperativeApi.complicationCreate(payload);
  return mapComplicationApiToRecord(result as PostComplicationApi);
}

/** 删除并发症（真实开关开→调 api）。 */
export async function deleteComplicationRemote(id: string | number): Promise<void> {
  if (!useRealPostoperative() || !isSamisLoggedIn()) {
    if (!useRealPostoperative()) await postoperativeApi.complicationDelete(id);
    return;
  }
  await postoperativeApi.complicationDelete(id);
}

/** 镇痛病例聚合（真实开关开→调 api；关→返回空由前端用 store.cases 派生）。 */
export async function loadRemoteAnalgesiaCases(params?: {
  room?: string;
}): Promise<PostListState<PostCaseSummary>> {
  const query = { room: params?.room, page: 1, pageSize: 200 };
  if (!useRealPostoperative() || !isSamisLoggedIn()) {
    if (!useRealPostoperative()) {
      const { list, total } = extractList(await postoperativeApi.analgesiaCases(query));
      return { list: (list as PostCaseSummaryApi[]).map(mapCaseSummaryApiToSummary), total, source: 'mock' };
    }
    return { list: [], total: 0, source: 'mock' };
  }
  try {
    const { list, total } = extractList(await postoperativeApi.analgesiaCases(query));
    return { list: (list as PostCaseSummaryApi[]).map(mapCaseSummaryApiToSummary), total, source: 'remote' };
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载镇痛病例失败')}，已使用本地数据`));
    return { list: [], total: 0, source: 'mock' };
  }
}

/** 非计划事件病例聚合（真实开关开→调 api；关→返回空由前端派生）。 */
export async function loadRemoteUnplannedCases(params?: {
  room?: string;
}): Promise<PostListState<PostCaseSummary>> {
  const query = { room: params?.room, page: 1, pageSize: 200 };
  if (!useRealPostoperative() || !isSamisLoggedIn()) {
    if (!useRealPostoperative()) {
      const { list, total } = extractList(await postoperativeApi.unplannedCases(query));
      return { list: (list as PostCaseSummaryApi[]).map(mapCaseSummaryApiToSummary), total, source: 'mock' };
    }
    return { list: [], total: 0, source: 'mock' };
  }
  try {
    const { list, total } = extractList(await postoperativeApi.unplannedCases(query));
    return { list: (list as PostCaseSummaryApi[]).map(mapCaseSummaryApiToSummary), total, source: 'remote' };
  } catch (error) {
    notifyIfUnhandledSamisError(error, () => Message.warning(`${describeError(error, '加载非计划事件失败')}，已使用本地数据`));
    return { list: [], total: 0, source: 'mock' };
  }
}

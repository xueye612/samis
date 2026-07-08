import { Message } from '@arco-design/web-vue';
import { qualityApi, type QualityFilterQuery, type QualityHypothermiaResultApi, type QualityAdverseEventResultApi, type QualityCheckApi, type QualityCheckListApi, type QualityCheckListQuery, type QualityCheckResultApi, type QualityRectifyStatusApi, type QualityIndicatorApi, type QualityIndicatorDetailApi } from '@/api/quality';
import { useRealQuality } from '@/config/apiFlags';
import { SamisHttpError } from '@/api/samisHttpClient';
import { isSamisLoggedIn } from '@/services/session/samisSession';

function describeError(error: unknown, fallback: string): string {
  if (error instanceof SamisHttpError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

function shouldUseReal(): boolean {
  return useRealQuality() && isSamisLoggedIn();
}

/** 低体温病例聚合（真实开关开→远程；失败返回空 + 警告）。 */
export async function loadHypothermiaCases(params: QualityFilterQuery = {}): Promise<{
  result: QualityHypothermiaResultApi;
  source: 'remote' | 'mock';
}> {
  if (!shouldUseReal()) {
    return { result: { total: 0, list: [] }, source: 'mock' };
  }
  try {
    const result = await qualityApi.getHypothermiaCases(params);
    return { result, source: 'remote' };
  } catch (error) {
    Message.warning(`${describeError(error, '加载低体温病例失败')}，已使用本地数据`);
    return { result: { total: 0, list: [] }, source: 'mock' };
  }
}

/** 不良事件聚合（真实开关开→远程；失败返回空 + 警告）。 */
export async function loadAdverseEvents(params: QualityFilterQuery = {}): Promise<{
  result: QualityAdverseEventResultApi;
  source: 'remote' | 'mock';
}> {
  if (!shouldUseReal()) {
    return { result: { total: 0, list: [] }, source: 'mock' };
  }
  try {
    const result = await qualityApi.getAdverseEvents(params);
    return { result, source: 'remote' };
  } catch (error) {
    Message.warning(`${describeError(error, '加载不良事件失败')}，已使用本地数据`);
    return { result: { total: 0, list: [] }, source: 'mock' };
  }
}

/** 26 指标列表（真实开关开→远程权威值；失败返回空 + 警告，视图回退本地 TS 计算）。 */
export async function loadIndicators(params: QualityFilterQuery = {}): Promise<{
  result: QualityIndicatorApi[];
  source: 'remote' | 'mock';
}> {
  if (!shouldUseReal()) {
    return { result: [], source: 'mock' };
  }
  try {
    const result = await qualityApi.getIndicators(params);
    return { result: result ?? [], source: 'remote' };
  } catch (error) {
    Message.warning(`${describeError(error, '加载质控指标失败')}，已使用本地数据`);
    return { result: [], source: 'mock' };
  }
}

/** 单指标穿透详情（真实开关开→远程权威值 + 穿透 cases；失败返回 null + 警告）。 */
export async function loadIndicatorDetail(code: string, params: QualityFilterQuery = {}): Promise<{
  result: QualityIndicatorDetailApi | null;
  source: 'remote' | 'mock';
}> {
  if (!shouldUseReal()) {
    return { result: null, source: 'mock' };
  }
  try {
    const result = await qualityApi.getIndicatorDetail(code, params);
    return { result, source: 'remote' };
  } catch (error) {
    Message.warning(`${describeError(error, '加载指标穿透明细失败')}，已使用本地数据`);
    return { result: null, source: 'mock' };
  }
}

/** 抽查记录分页列表（真实开关开→远程；失败返回空 + 警告）。 */
export async function loadQualityChecks(params: QualityCheckListQuery = {}): Promise<{
  list: QualityCheckApi[];
  total: number;
  source: 'remote' | 'mock';
}> {
  if (!shouldUseReal()) {
    const result = await qualityApi.checkList(params);
    const body = (result ?? {}) as Partial<QualityCheckListApi>;
    const list = Array.isArray(body.list) ? body.list : [];
    return { list, total: typeof body.total === 'number' ? body.total : list.length, source: 'mock' };
  }
  try {
    const result = await qualityApi.checkList({ ...params, page: 1, pageSize: 100 });
    const body = (result ?? {}) as Partial<QualityCheckListApi>;
    const list = Array.isArray(body.list) ? body.list : [];
    return { list, total: typeof body.total === 'number' ? body.total : list.length, source: 'remote' };
  } catch (error) {
    Message.warning(`${describeError(error, '加载质控抽查记录失败')}，已使用本地数据`);
    return { list: [], total: 0, source: 'mock' };
  }
}

export interface QualityCheckInput {
  checkItem: string;
  standard?: string;
  result?: QualityCheckResultApi;
  rectifyStatus?: QualityRectifyStatusApi;
  checker?: string;
  checkDate?: string;
  issueDesc?: string;
}

/** 创建抽查记录（真实开关开→远程返回新行；关→返回 null 由 store 本地构建）。 */
export async function createQualityCheckRemote(input: QualityCheckInput): Promise<QualityCheckApi | null> {
  const payload: Record<string, unknown> = { checkItem: input.checkItem };
  if (input.standard !== undefined) payload.standard = input.standard;
  if (input.result !== undefined) payload.result = input.result;
  if (input.rectifyStatus !== undefined) payload.rectifyStatus = input.rectifyStatus;
  if (input.checker !== undefined) payload.checker = input.checker;
  if (input.checkDate !== undefined) payload.checkDate = input.checkDate;
  if (input.issueDesc !== undefined) payload.issueDesc = input.issueDesc;

  if (!shouldUseReal()) {
    await qualityApi.checkCreate(payload); // mock 兜底
    return null;
  }
  const result = await qualityApi.checkCreate(payload);
  return result as QualityCheckApi;
}

export type QualityCheckPatch = Partial<QualityCheckInput>;

/** 更新抽查记录（真实开关开→调 api）。 */
export async function updateQualityCheckRemote(id: number | string, patch: QualityCheckPatch): Promise<void> {
  const payload: Record<string, unknown> = { id };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) payload[key] = value;
  }
  if (!shouldUseReal()) {
    await qualityApi.checkUpdate(payload); // mock 兜底
    return;
  }
  await qualityApi.checkUpdate(payload);
}

/** 删除抽查记录（真实开关开→调 api）。 */
export async function deleteQualityCheckRemote(id: number | string): Promise<void> {
  if (!shouldUseReal()) {
    await qualityApi.checkDelete(id); // mock 兜底
    return;
  }
  await qualityApi.checkDelete(id);
}

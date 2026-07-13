import dayjs from 'dayjs';
import { Message } from '@arco-design/web-vue';
import { operationInfoApi } from '@/api/operationInfo';
import { notifyIfUnhandledSamisError } from '@/services/auth/authErrorPresentation';
import { useRealOperationInfo } from '@/config/apiFlags';
import { SamisHttpError } from '@/api/samisHttpClient';
import type { SurgeryCase } from '@/types/anesthesia';
import {
  buildSnapshotFromOperation,
  mapOperationDetail,
  mapOperationListItem,
  mapOperationListResponse,
  mapWorkbenchResponse,
  mergeOperationIntoCase,
  shouldSkipRemoteOperationRefresh,
  type OperationInfoQuery,
  type OperationListQuery,
  type WorkbenchRoomStatus,
  type WorkbenchSummary,
} from '@/services/anesthesia/adapters/operationInfoAdapter';
import { hydrateAnesthesiaCasesFromLocalDb } from '@/services/anesthesia/anesthesiaPersistenceBridge';
import { persistCaseNow } from '@/services/anesthesia/anesthesiaPersistenceBridge';
import { hydrateCaseFromServer } from '@/services/anesthesia/anesthesiaRecordHydrate';

export interface FetchOperationListResult {
  cases: SurgeryCase[];
  source: 'remote' | 'mock' | 'seed';
  message?: string;
}

export async function fetchOperationList(
  params: OperationListQuery = {},
): Promise<FetchOperationListResult> {
  const query = {
    operationDate: params.operationDate ?? dayjs().format('YYYY-MM-DD'),
    ...params,
  };

  if (!useRealOperationInfo()) {
    const raw = await operationInfoApi.getOperationList(query);
    const cases = mapOperationListResponse(raw);
    return {
      cases: await hydrateAnesthesiaCasesFromLocalDb(cases, { appendOrphans: false }),
      source: 'mock',
    };
  }

  try {
    const raw = await operationInfoApi.getOperationList(query);
    const cases = mapOperationListResponse(raw);
    if (!cases.length) {
      Message.info('当日手术通知单为空');
      return { cases: [], source: 'remote', message: 'empty list' };
    }
    return {
      cases: await hydrateAnesthesiaCasesFromLocalDb(cases, { appendOrphans: false }),
      source: 'remote',
    };
  } catch (error) {
    const msg = error instanceof SamisHttpError
      ? error.message
      : error instanceof Error
        ? error.message
        : '加载手术列表失败';
    notifyIfUnhandledSamisError(error, () => Message.warning(msg));
    return { cases: [], source: 'remote', message: msg };
  }
}

export async function fetchOperationDetail(params: OperationInfoQuery) {
  const raw = await operationInfoApi.getOperationInfo(params);
  return mapOperationDetail(raw);
}

export async function fetchOperationCaseById(operationId: string): Promise<SurgeryCase | null> {
  if (!operationId) return null;
  const raw = await operationInfoApi.getOperationInfo({
    operationId,
    OPERATIONID: operationId,
  });
  const item = mapOperationListItem(raw);
  return item.id === operationId ? item : null;
}

export interface FetchTodayWorkbenchResult {
  cases: SurgeryCase[];
  roomStatus: WorkbenchRoomStatus[];
  summary: WorkbenchSummary;
  source: 'remote' | 'mock';
  message?: string;
}

/**
 * 今日工作台聚合：优先后端 todayWorkbench 端点（一次请求返回病例+房间聚合+汇总），
 * 与 fetchOperationList 共用 useRealOperationInfo() 开关，Mock 模式走前端 samisMockRouter。
 */
export async function fetchTodayWorkbench(): Promise<FetchTodayWorkbenchResult> {
  if (!useRealOperationInfo()) {
    const raw = await operationInfoApi.getTodayWorkbench();
    const { cases, roomStatus, summary } = mapWorkbenchResponse(raw);
    return {
      cases: await hydrateAnesthesiaCasesFromLocalDb(cases, { appendOrphans: false }),
      roomStatus,
      summary,
      source: 'mock',
    };
  }
  try {
    const raw = await operationInfoApi.getTodayWorkbench();
    const { cases, roomStatus, summary } = mapWorkbenchResponse(raw);
    return {
      cases: await hydrateAnesthesiaCasesFromLocalDb(cases, { appendOrphans: false }),
      roomStatus,
      summary,
      source: 'remote',
    };
  } catch (error) {
    const msg = error instanceof SamisHttpError
      ? error.message
      : error instanceof Error
        ? error.message
        : '加载今日工作台失败';
    notifyIfUnhandledSamisError(error, () => Message.warning(msg));
    return { cases: [], roomStatus: [], summary: { surgeries: 0, busyRooms: 0, roomCount: 0, canceled: 0 }, source: 'remote', message: msg };
  }
}

export async function hydrateCaseFromOperationInfo(
  caseItem: SurgeryCase | undefined,
  options?: { force?: boolean },
): Promise<SurgeryCase | null> {
  if (!caseItem) return null;
  if (!options?.force && shouldSkipRemoteOperationRefresh(caseItem)) {
    return caseItem;
  }

  const applyDetail = (detail: ReturnType<typeof mapOperationDetail>) => {
    const merged = mergeOperationIntoCase(caseItem, detail);
    if (!shouldSkipRemoteOperationRefresh(merged)) {
      merged.recordSnapshot = buildSnapshotFromOperation(
        merged,
        merged.recordDocument?.hospitalName,
      );
    }
    return merged;
  };

  if (!useRealOperationInfo()) {
    try {
      const raw = await operationInfoApi.getOperationInfo({
        operationId: caseItem.id,
        patientNumber: caseItem.patientId,
      });
      return applyDetail(mapOperationDetail(raw));
    } catch {
      return caseItem;
    }
  }

  try {
    const detail = await fetchOperationDetail({
      operationId: caseItem.id,
      OPERATIONID: caseItem.id,
    });
    const merged = applyDetail(detail);
    // Slice 3f：冷启动服务端回读 —— 若本地无该 operationId 的 case，
    // 从 getRecordDetail 聚合重建（含临床列表）并 seed 本地；否则维持 operationInfo 兜底。
    const hydrated = await hydrateCaseFromServer(caseItem.id, merged);
    if (hydrated) return hydrated;
    await persistCaseNow(merged, undefined, { entityType: 'snapshot', operationType: 'update' });
    return merged;
  } catch (error) {
    const msg = error instanceof Error ? error.message : '加载手术通知单失败';
    notifyIfUnhandledSamisError(error, () => Message.warning(msg));
    return caseItem;
  }
}

export async function refreshOperationInfoIfAllowed(caseItem: SurgeryCase | undefined) {
  return hydrateCaseFromOperationInfo(caseItem);
}

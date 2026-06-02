import dayjs from 'dayjs';
import { Message } from '@arco-design/web-vue';
import { operationInfoApi } from '@/api/operationInfo';
import { useRealOperationInfo } from '@/config/apiFlags';
import { SamisHttpError } from '@/api/samisHttpClient';
import type { SurgeryCase } from '@/types/anesthesia';
import {
  buildSnapshotFromOperation,
  mapOperationDetail,
  mapOperationListResponse,
  mergeOperationIntoCase,
  shouldSkipRemoteOperationRefresh,
  type OperationInfoQuery,
  type OperationListQuery,
} from '@/services/anesthesia/adapters/operationInfoAdapter';
import { hydrateAnesthesiaCasesFromLocalDb } from '@/services/anesthesia/anesthesiaPersistenceBridge';
import { persistCaseNow } from '@/services/anesthesia/anesthesiaPersistenceBridge';

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
    Message.warning(msg);
    return { cases: [], source: 'remote', message: msg };
  }
}

export async function fetchOperationDetail(params: OperationInfoQuery) {
  const raw = await operationInfoApi.getOperationInfo(params);
  return mapOperationDetail(raw);
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
      patientNumber: caseItem.patientId,
    });
    const merged = applyDetail(detail);
    await persistCaseNow(merged, undefined, { entityType: 'snapshot', operationType: 'update' });
    return merged;
  } catch (error) {
    const msg = error instanceof Error ? error.message : '加载手术通知单失败';
    Message.warning(msg);
    return caseItem;
  }
}

export async function refreshOperationInfoIfAllowed(caseItem: SurgeryCase | undefined) {
  return hydrateCaseFromOperationInfo(caseItem);
}


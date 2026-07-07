import { samisRequest } from '@/api/samisClient';
import {
  buildFormPost,
  flatFormFieldsFromRecord,
  stringifyFormJsonField,
} from '@/api/samisFormBody';
import type {
  NursePbListQuery,
  OperationInfoQuery,
  OperationListQuery,
} from '@/services/anesthesia/adapters/operationInfoAdapter';
import {
  buildNursePbListQuery,
  buildOperationInfoQuery,
  buildOperationListQuery,
} from '@/services/anesthesia/adapters/operationInfoAdapter';

export type { NursePbListQuery };

export const operationInfoApi = {
  getOperationList(params: OperationListQuery = {}) {
    const query = buildOperationListQuery(params);
    const suffix = query ? `?${query}` : '';
    return samisRequest<unknown>(`/operationInfo/getOperationList${suffix}`, undefined, {
      module: 'operationInfo',
    });
  },
  getOperationInfo(params: OperationInfoQuery) {
    const query = buildOperationInfoQuery(params);
    return samisRequest<unknown>(`/operationInfo/getOperationInfo?${query}`, undefined, {
      module: 'operationInfo',
    });
  },
  updateOperationInfo(data: unknown) {
    const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    return samisRequest<unknown>(
      '/operationInfo/updateOperationInfo',
      buildFormPost(flatFormFieldsFromRecord(record)),
      { module: 'operationInfo' },
    );
  },
  getNursePbList(params: NursePbListQuery | Record<string, string | number | undefined>) {
    const query = 'startTime' in params && 'endTime' in params
      ? buildNursePbListQuery(params as NursePbListQuery)
      : new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)]),
      ).toString();
    const suffix = query ? `?${query}` : '';
    return samisRequest<unknown>(`/operationInfo/getNursePbList${suffix}`, undefined, {
      module: 'operationInfo',
    });
  },
  saveNursePb(data: unknown) {
    const items = Array.isArray(data) ? data : [data];
    return samisRequest<unknown>(
      '/operationInfo/saveNursePb',
      buildFormPost({ data: stringifyFormJsonField(items) }),
      { module: 'operationInfo' },
    );
  },
  updateNumberOfStations(data: unknown) {
    const record = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    const items = record.items;
    const formRecord = items !== undefined
      ? { data: stringifyFormJsonField(items) }
      : flatFormFieldsFromRecord(record);
    return samisRequest<unknown>(
      '/operationInfo/updateNumberOfStations',
      buildFormPost(formRecord),
      { module: 'operationInfo' },
    );
  },
  /**
   * 今日工作台聚合：后端按当前用户 roomGroup/roomTypeCodeList 过滤当日手术，
   * 并按手术间维度聚合，返回 { todayCases, roomStatus, summary }。
   */
  getTodayWorkbench() {
    return samisRequest<unknown>('/operationInfo/todayWorkbench', undefined, {
      module: 'operationInfo',
    });
  },
};

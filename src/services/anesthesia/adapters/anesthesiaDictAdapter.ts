import { unwrapListPayload } from '@/services/anesthesia/adapters/fieldUtils';
import type { ApiDrugDictItem } from '@/types/drugDict';
import { apiDrugDictToItem } from '@/services/drugDictMapper';
import type { DrugDictItem } from '@/types/system';

/** 字典接口常见分页：data[] / data.list / data.records */
export function unwrapDictListPayload<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== 'object') return unwrapListPayload<T>(data);
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.list)) return record.list as T[];
  if (Array.isArray(record.records)) return record.records as T[];
  if (Array.isArray(record.items)) return record.items as T[];
  return unwrapListPayload<T>(data);
}

export function mapDrugDictListResponse(data: unknown): DrugDictItem[] {
  return unwrapDictListPayload<ApiDrugDictItem>(data)
    .map((row) => apiDrugDictToItem(row))
    .filter((item) => item.name);
}

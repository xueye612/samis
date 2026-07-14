import { unwrapListPayload, pickString, pickNumber, pickField } from '@/services/anesthesia/adapters/fieldUtils';
import type { ApiDrugDictItem } from '@/types/drugDict';
import { apiDrugDictToItem } from '@/services/drugDictMapper';
import type { DrugDictItem, ProfessionalDictItem, ProfessionalProfile, ProfessionalHistoryItem } from '@/types/system';

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

/** P06A：麻醉方式/事件/评分结构化项映射，保留服务端 ID/编码/版本与 profile；不以名称反造编码。 */
export function mapProfessionalItem(raw: unknown, fallbackCategory: string): ProfessionalDictItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const categoryCode = pickString(record, ['categoryCode', 'category_code'], fallbackCategory);
  return {
    id: pickNumber(record, ['id'], 0),
    categoryCode,
    itemCode: pickString(record, ['itemCode', 'item_code'], ''),
    itemName: pickString(record, ['itemName', 'item_name'], ''),
    parentCode: nullableStr(record, ['parentCode', 'parent_code']),
    sortNo: pickNumber(record, ['sortNo', 'sort_no'], 0),
    status: pickString(record, ['status'], ''),
    version: pickNumber(record, ['version'], 0),
    remark: nullableStr(record, ['remark']),
    profile: mapProfile(categoryCode, pickField(record, ['profile'])),
  };
}

function nullableStr(raw: unknown, keys: string[]): string | null {
  const value = pickField(raw, keys);
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function mapProfile(categoryCode: string, raw: unknown): ProfessionalProfile {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (categoryCode === 'anesthesia_method') {
    return {
      applicableOperationTypes: nullableStr(p, ['applicableOperationTypes', 'applicable_operation_types']),
      defaultTemplateCode: nullableStr(p, ['defaultTemplateCode', 'default_template_code']),
      medicationPlan: nullableStr(p, ['medicationPlan', 'medication_plan']),
      monitoringPlan: nullableStr(p, ['monitoringPlan', 'monitoring_plan']),
      airwayStrategy: nullableStr(p, ['airwayStrategy', 'airway_strategy']),
      analgesiaStrategy: nullableStr(p, ['analgesiaStrategy', 'analgesia_strategy']),
      pacuDestination: nullableStr(p, ['pacuDestination', 'pacu_destination']),
      risks: nullableStr(p, ['risks']),
      contraindications: nullableStr(p, ['contraindications']),
      version: pickNumber(p, ['version'], 0),
    };
  }
  if (categoryCode === 'anesthesia_event') {
    return {
      eventCategory: nullableStr(p, ['eventCategory', 'event_category']),
      severity: nullableStr(p, ['severity']),
      responseGuidance: nullableStr(p, ['responseGuidance', 'response_guidance']),
      qualityIncluded: !!pickField(p, ['qualityIncluded', 'quality_included']),
      version: pickNumber(p, ['version'], 0),
    };
  }
  if (categoryCode === 'anesthesia_score') {
    const rule = pickField(p, ['ruleDefinition', 'rule_definition']);
    return {
      scoreType: nullableStr(p, ['scoreType', 'score_type']),
      ruleDefinition: typeof rule === 'string' ? safeJson(rule) : rule,
      applicableScenario: nullableStr(p, ['applicableScenario', 'applicable_scenario']),
      thresholdInterpretation: nullableStr(p, ['thresholdInterpretation', 'threshold_interpretation']),
      version: pickNumber(p, ['version'], 0),
    };
  }
  return null;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function mapProfessionalItemList(data: unknown, categoryCode: string): ProfessionalDictItem[] {
  return unwrapDictListPayload<unknown>(data)
    .map((raw) => mapProfessionalItem(raw, categoryCode))
    .filter((item): item is ProfessionalDictItem => item !== null);
}

export function mapProfessionalHistory(data: unknown): ProfessionalHistoryItem[] {
  return unwrapDictListPayload<unknown>(data).map((raw) => {
    const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      id: pickNumber(record, ['id'], 0),
      fromStatus: nullableStr(record, ['fromStatus', 'from_status']),
      toStatus: pickString(record, ['toStatus', 'to_status'], ''),
      reason: nullableStr(record, ['reason']),
      actor: nullableStr(record, ['actor']),
      version: pickNumber(record, ['version'], 0),
      occurredAt: nullableStr(record, ['occurredAt', 'occurred_at']),
    };
  });
}

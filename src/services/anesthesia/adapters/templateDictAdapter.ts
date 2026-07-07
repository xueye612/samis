import { pickBoolean, pickString } from '@/services/anesthesia/adapters/fieldUtils';
import { unwrapDictListPayload } from '@/services/anesthesia/adapters/anesthesiaDictAdapter';
import type { PrintTemplateItem } from '@/types/system';

export function mapTemplateItem(raw: unknown): PrintTemplateItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const name = pickString(record, ['template_name', 'templateName', 'name', 'item_name'], '');
  const code = pickString(record, ['template_code', 'templateCode', 'code'], '');
  if (!name && !code) return null;
  return {
    id: pickString(record, ['id'], code || name),
    templateCode: code || undefined,
    templateName: name || code,
    templateType: pickString(record, ['template_type', 'templateType'], '') || undefined,
    isDefault: pickBoolean(record, ['is_default', 'isDefault'], false),
    enabled: pickBoolean(record, ['enabled', 'is_active'], true),
    remark: pickString(record, ['remark'], '') || undefined,
  };
}

export function mapTemplateListResponse(data: unknown): PrintTemplateItem[] {
  return unwrapDictListPayload<unknown>(data)
    .map(mapTemplateItem)
    .filter((item): item is PrintTemplateItem => item !== null);
}

/** 历史兼容：模板对象降级为字符串名称数组。 */
export function templateNamesFromItems(items: PrintTemplateItem[]): string[] {
  return items.map((item) => item.templateName).filter(Boolean);
}

import { pickBoolean, pickField, pickNumber, pickString } from '@/services/anesthesia/adapters/fieldUtils';
import { unwrapDictListPayload } from '@/services/anesthesia/adapters/anesthesiaDictAdapter';
import type { VitalSignDictItem } from '@/types/system';

export function mapVitalDictItem(raw: unknown): VitalSignDictItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const code = pickString(record, ['code'], '');
  const name = pickString(record, ['itemName', 'item_name', 'name'], '');
  const shortCode = pickString(record, ['shortCode', 'short_code'], '');
  if (!name && !shortCode && !code) return null;
  const lowerRaw = pickField(record, ['lowerLimit', 'lower_limit']);
  const upperRaw = pickField(record, ['upperLimit', 'upper_limit']);
  const toLimit = (raw: unknown): number | undefined =>
    raw === undefined || raw === null || raw === '' ? undefined : (Number.isFinite(Number(raw)) ? Number(raw) : undefined);
  return {
    id: String(pickNumber(record, ['id'])) || code || shortCode || name,
    code,
    name,
    shortCode,
    unit: pickString(record, ['unit'], '') || '',
    normalRange: pickString(record, ['normalRange', 'normal_range'], '') || undefined,
    lowerLimit: toLimit(lowerRaw),
    upperLimit: toLimit(upperRaw),
    defaultValue: pickString(record, ['defaultValue', 'default_value'], '') || undefined,
    chartEnabled: pickBoolean(record, ['chartEnabled', 'chart_enabled'], true),
    chartColor: pickString(record, ['chartColor', 'chart_color'], '') || undefined,
    chartSymbol: (pickString(record, ['chartSymbol', 'chart_symbol'], 'circle') || 'circle') as VitalSignDictItem['chartSymbol'],
    decimalPlaces: pickNumber(record, ['decimalPlaces', 'decimal_places'], 0),
    sortOrder: pickNumber(record, ['sortOrder', 'sort_no', 'sort_order'], 0),
    enabled: pickBoolean(record, ['enabled', 'is_active'], true),
  };
}

export function mapVitalDictListResponse(data: unknown): VitalSignDictItem[] {
  return unwrapDictListPayload<unknown>(data)
    .map(mapVitalDictItem)
    .filter((item): item is VitalSignDictItem => item !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

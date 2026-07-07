import { pickBoolean, pickNumber, pickString } from '@/services/anesthesia/adapters/fieldUtils';
import { unwrapDictListPayload } from '@/services/anesthesia/adapters/anesthesiaDictAdapter';
import type { FluidBloodDictItem, FluidBloodSubCategory } from '@/types/system';

const SUB_CATEGORIES: FluidBloodSubCategory[] = ['晶体液', '胶体液', '血液制品', '自体血回输'];

function isBloodProductRow(raw: Record<string, unknown>): boolean {
  const code = pickString(raw, ['product_code', 'productCode', 'code'], '').toUpperCase();
  const name = pickString(raw, ['product_name', 'productName', 'name'], '');
  const hasFluidField = pickString(raw, ['fluid_code', 'fluidCode'], '') !== '';
  const hasProductField = pickString(raw, ['product_code', 'productCode'], '') !== '';
  if (hasProductField && !hasFluidField) return true;
  if (hasFluidField) return false;
  return code.startsWith('RBC') || code.startsWith('FFP') || code.startsWith('PLT')
    || code.startsWith('CRYO') || name.includes('血');
}

function inferSubCategory(raw: Record<string, unknown>): FluidBloodSubCategory {
  const explicit = pickString(raw, ['subCategory', 'sub_category', 'fluid_type', 'fluidType', 'product_type', 'productType'], '');
  const matched = SUB_CATEGORIES.find((c) => explicit === c || explicit.includes(c));
  if (matched) return matched;
  if (isBloodProductRow(raw)) return '血液制品';
  const name = pickString(raw, ['name', 'fluid_name', 'productName'], '');
  if (name.includes('自体')) return '自体血回输';
  if (name.includes('明胶') || name.includes('淀粉') || name.includes('胶体')) return '胶体液';
  return '晶体液';
}

export function mapFluidDictItem(raw: unknown): FluidBloodDictItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const id = String(pickNumber(record, ['id']));
  const code = pickString(record, ['code', 'fluid_code', 'fluidCode', 'product_code', 'productCode'], '');
  const name = pickString(record, ['name', 'fluid_name', 'fluidName', 'product_name', 'productName', 'item_name'], '');
  if (!name && !code) return null;
  return {
    id: id || code || name,
    code,
    name,
    subCategory: inferSubCategory(record),
    defaultUnit: pickString(record, ['defaultUnit', 'default_unit', 'unit'], 'ml') || 'ml',
    defaultVolume: pickNumber(record, ['defaultVolume', 'default_volume'], 0) || undefined,
    requiresDoubleCheck: pickBoolean(record, ['requiresDoubleCheck', 'requires_double_check', 'is_count_input'], false),
    remark: pickString(record, ['remark'], '') || undefined,
    enabled: pickBoolean(record, ['enabled', 'is_active'], true),
  };
}

export function mapFluidDictListResponse(data: unknown): FluidBloodDictItem[] {
  return unwrapDictListPayload<unknown>(data)
    .map(mapFluidDictItem)
    .filter((item): item is FluidBloodDictItem => item !== null);
}

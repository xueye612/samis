import { pickBoolean, pickNumber, pickString } from '@/services/anesthesia/adapters/fieldUtils';
import { unwrapDictListPayload } from '@/services/anesthesia/adapters/anesthesiaDictAdapter';
import type { StaffDictItem } from '@/types/system';

export function mapStaffItem(raw: unknown): StaffDictItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const name = pickString(record, ['name'], '');
  const gh = pickString(record, ['gh'], '');
  if (!name && !gh) return null;
  return {
    id: String(pickNumber(record, ['id'])) || gh || name,
    gh: gh || undefined,
    name,
    title: pickString(record, ['title'], '') || undefined,
    departmentCode: pickString(record, ['departmentCode', 'department_code'], '') || undefined,
    departmentName: pickString(record, ['departmentName', 'department_name'], '') || undefined,
    role: pickString(record, ['role'], '麻醉医生') || '麻醉医生',
    schedulingWeight: pickNumber(record, ['schedulingWeight', 'scheduling_weight'], 1),
    sortOrder: pickNumber(record, ['sortOrder', 'sort_no'], 0),
    enabled: pickBoolean(record, ['enabled', 'is_active'], true),
    remark: pickString(record, ['remark'], '') || undefined,
  };
}

export function mapStaffListResponse(data: unknown): StaffDictItem[] {
  return unwrapDictListPayload<unknown>(data)
    .map(mapStaffItem)
    .filter((item): item is StaffDictItem => item !== null)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** 历史兼容：人员对象降级为字符串姓名数组（去重）。 */
export function staffNamesFromItems(items: StaffDictItem[]): string[] {
  return [...new Set(items.map((item) => item.name).filter(Boolean))];
}

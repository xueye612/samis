import { pickBoolean, pickNumber, pickString, pickField } from '@/services/anesthesia/adapters/fieldUtils';
import { unwrapDictListPayload } from '@/services/anesthesia/adapters/anesthesiaDictAdapter';
import type { StaffDictItem, StaffProfile, StaffScope, ProfessionalHistoryItem } from '@/types/system';

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

/** P06A：人员结构化 profile 映射，保留 false/0/null 与整数版本，不以名称反造工号。 */
export function mapStaffProfile(raw: unknown): StaffProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const rawScopes = pickField(record, ['scopes']);
  const scopes: StaffScope[] = Array.isArray(rawScopes)
    ? rawScopes
        .map((s): StaffScope | null => {
          const sc = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
          const type = pickString(sc, ['scopeType', 'scope_type'], '');
          const code = pickString(sc, ['scopeCode', 'scope_code'], '');
          if (!type || !code) return null;
          const nameVal = sc.scopeName ?? sc.scope_name ?? null;
          return { scopeType: type as StaffScope['scopeType'], scopeCode: code, scopeName: nameVal === null ? null : String(nameVal) };
        })
        .filter((s): s is StaffScope => s !== null)
    : [];
  return {
    id: pickNumber(record, ['id'], 0),
    gh: pickString(record, ['gh'], ''),
    name: pickString(record, ['name'], ''),
    title: nullableStr(record, ['title']),
    departmentCode: nullableStr(record, ['departmentCode', 'department_code']),
    departmentName: nullableStr(record, ['departmentName', 'department_name']),
    role: pickString(record, ['role'], '麻醉医生'),
    professionalGroup: nullableStr(record, ['professionalGroup', 'professional_group']),
    authorizationLevel: nullableStr(record, ['authorizationLevel', 'authorization_level']),
    schedulingWeight: pickNumber(record, ['schedulingWeight', 'scheduling_weight'], 0),
    validFrom: nullableStr(record, ['validFrom', 'valid_from']),
    validTo: nullableStr(record, ['validTo', 'valid_to']),
    status: pickString(record, ['status'], ''),
    statusReason: nullableStr(record, ['statusReason', 'status_reason']),
    effectiveAt: nullableStr(record, ['effectiveAt', 'effective_at']),
    pausedAt: nullableStr(record, ['pausedAt', 'paused_at']),
    disabledAt: nullableStr(record, ['disabledAt', 'disabled_at']),
    version: pickNumber(record, ['version'], 0),
    sortNo: pickNumber(record, ['sortNo', 'sort_no'], 0),
    remark: nullableStr(record, ['remark']),
    adminUserId: pickNumber(record, ['adminUserId', 'admin_user_id'], 0) || null,
    scopes,
  };
}

function nullableStr(raw: unknown, keys: string[]): string | null {
  const value = pickField(raw, keys);
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

export function mapStaffProfileList(data: unknown): StaffProfile[] {
  return unwrapDictListPayload<unknown>(data)
    .map(mapStaffProfile)
    .filter((item): item is StaffProfile => item !== null);
}

export function mapStaffHistory(data: unknown): ProfessionalHistoryItem[] {
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

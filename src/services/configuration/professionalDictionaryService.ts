import { anesthesiaDictApi } from '@/api/anesthesiaDict';
import { SamisHttpError } from '@/api/samisHttpClient';
import { mapStaffProfile, mapStaffProfileList, mapStaffHistory } from '@/services/anesthesia/adapters/staffDictAdapter';
import { mapProfessionalItem, mapProfessionalItemList, mapProfessionalHistory, mapMethodCategory, mapMethodCategoryList } from '@/services/anesthesia/adapters/anesthesiaDictAdapter';
import type { StaffProfile, ProfessionalDictItem, ProfessionalHistoryItem, MethodCategory } from '@/types/system';

export const PROFESSIONAL_CONFLICT_CODE = 4091;
export const STAFF_PERM = 'config.staff.manage';
export const METHOD_PERM = 'config.method.manage';
export const EVENT_PERM = 'config.event.manage';
export const SCORE_PERM = 'config.score.manage';

export const METHOD_CATEGORY = 'anesthesia_method';
export const EVENT_CATEGORY = 'anesthesia_event';
export const SCORE_CATEGORY = 'anesthesia_score';

export class ProfessionalConflictError extends Error {
  constructor(message = '数据已被其他人修改，请刷新后重试') {
    super(message);
    this.name = 'ProfessionalConflictError';
  }
}

export function canManageStaff(permissions: string[] | null | undefined): boolean {
  return hasPermission(permissions, STAFF_PERM);
}
export function canManageProfessional(permissions: string[] | null | undefined, category: string): boolean {
  const code = category === EVENT_CATEGORY ? EVENT_PERM : category === SCORE_CATEGORY ? SCORE_PERM : METHOD_PERM;
  return hasPermission(permissions, code);
}
function hasPermission(permissions: string[] | null | undefined, code: string): boolean {
  if (!permissions) return false;
  return permissions.some((p) => p === '*' || p === code);
}

function unwrap(response: unknown): unknown {
  if (response && typeof response === 'object') {
    const record = response as Record<string, unknown>;
    if (record.data !== undefined) return record.data;
  }
  return response;
}

function throwIfConflict(error: unknown): never {
  if (error instanceof SamisHttpError && error.code === PROFESSIONAL_CONFLICT_CODE) {
    throw new ProfessionalConflictError();
  }
  throw error;
}

// ===== 人员 =====
export async function loadStaffConfig(params: { allStatus?: boolean; keyword?: string } = {}): Promise<StaffProfile[]> {
  const raw = await anesthesiaDictApi.getStaffConfig(params);
  return mapStaffProfileList(unwrap(raw));
}

export async function getStaffConfigDetail(id: number): Promise<StaffProfile | null> {
  const raw = await anesthesiaDictApi.getStaffDetail(id);
  return mapStaffProfile(unwrap(raw));
}

export async function saveStaffConfig(payload: Record<string, unknown>): Promise<{ id?: number; version: number }> {
  try {
    const result = await anesthesiaDictApi.saveStaff(payload);
    const data = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
    return { id: data.id === undefined ? undefined : Number(data.id), version: Number(data.version ?? 0) };
  } catch (error) {
    throwIfConflict(error);
  }
}

export async function changeStaffStatusConfig(payload: Record<string, unknown>): Promise<{ status: string; version: number }> {
  try {
    const result = await anesthesiaDictApi.changeProfessionalStatus({ entityType: 'staff', ...payload });
    const data = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
    return { status: String(data.status ?? ''), version: Number(data.version ?? 0) };
  } catch (error) {
    throwIfConflict(error);
  }
}

export async function loadStaffHistory(id: number): Promise<ProfessionalHistoryItem[]> {
  const raw = await anesthesiaDictApi.professionalHistory('staff', id);
  return mapStaffHistory(unwrap(raw));
}

// ===== 方式/事件/评分 =====
export async function loadProfessionalItems(categoryCode: string, allStatus = true): Promise<ProfessionalDictItem[]> {
  const raw = await anesthesiaDictApi.getProfessionalItems({ categoryCode, allStatus });
  return mapProfessionalItemList(unwrap(raw), categoryCode);
}

export async function getProfessionalItemDetail(id: number): Promise<ProfessionalDictItem | null> {
  const raw = await anesthesiaDictApi.getProfessionalItemDetail(id);
  return mapProfessionalItem(unwrap(raw), '');
}

export async function saveProfessionalItem(payload: Record<string, unknown>): Promise<{ id?: number; version: number }> {
  try {
    const result = await anesthesiaDictApi.saveProfessionalItem(payload);
    const data = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
    return { id: data.id === undefined ? undefined : Number(data.id), version: Number(data.version ?? 0) };
  } catch (error) {
    throwIfConflict(error);
  }
}

export async function changeProfessionalStatusConfig(payload: Record<string, unknown>): Promise<{ status: string; version: number }> {
  try {
    const result = await anesthesiaDictApi.changeProfessionalStatus(payload);
    const data = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
    return { status: String(data.status ?? ''), version: Number(data.version ?? 0) };
  } catch (error) {
    throwIfConflict(error);
  }
}

export async function loadProfessionalHistory(entityType: string, id: number): Promise<ProfessionalHistoryItem[]> {
  const raw = await anesthesiaDictApi.professionalHistory(entityType, id);
  return mapProfessionalHistory(unwrap(raw));
}

// ===== 麻醉方式大类 =====
export async function loadMethodCategories(params: { allStatus?: boolean; keyword?: string } = {}): Promise<MethodCategory[]> {
  const raw = await anesthesiaDictApi.getMethodCategories(params);
  return mapMethodCategoryList(unwrap(raw));
}

export async function saveMethodCategoryConfig(payload: Record<string, unknown>): Promise<{ id?: number; version: number }> {
  try {
    const result = await anesthesiaDictApi.saveMethodCategory(payload);
    const data = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
    return { id: data.id === undefined ? undefined : Number(data.id), version: Number(data.version ?? 0) };
  } catch (error) {
    throwIfConflict(error);
  }
}

export async function changeCategoryStatusConfig(payload: Record<string, unknown>): Promise<{ status: string; version: number }> {
  try {
    const result = await anesthesiaDictApi.changeProfessionalStatus({ entityType: 'method_category', ...payload });
    const data = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
    return { status: String(data.status ?? ''), version: Number(data.version ?? 0) };
  } catch (error) {
    throwIfConflict(error);
  }
}

export async function loadCategoryHistory(id: number): Promise<ProfessionalHistoryItem[]> {
  const raw = await anesthesiaDictApi.professionalHistory('method_category', id);
  return mapProfessionalHistory(unwrap(raw));
}

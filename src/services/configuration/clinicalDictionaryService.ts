import { anesthesiaDictApi } from '@/api/anesthesiaDict';
import { SamisHttpError } from '@/api/samisHttpClient';
import { unwrapDictListPayload } from '@/services/anesthesia/adapters/anesthesiaDictAdapter';

export const CLINICAL_CONFLICT_CODE = 4091;
export const DRUG_PERM = 'config.drug.manage';
export const FLUID_PERM = 'config.fluid.manage';
export const VITAL_PERM = 'config.vital.manage';
export const TEMPLATE_PERM = 'config.template.manage';

export type ClinicalEntity = 'drug' | 'fluid' | 'blood' | 'vital' | 'template';

export const ENTITY_LABELS: Record<ClinicalEntity, string> = {
  drug: '药品', fluid: '液体', blood: '血制品', vital: '生命体征', template: '模板',
};

export class ClinicalConflictError extends Error {
  constructor(message = '数据已被其他人修改，请刷新后重试') {
    super(message);
    this.name = 'ClinicalConflictError';
  }
}

export function canManageClinical(permissions: string[] | null | undefined, entity: ClinicalEntity): boolean {
  const code = entity === 'drug' ? DRUG_PERM : (entity === 'fluid' || entity === 'blood') ? FLUID_PERM : entity === 'vital' ? VITAL_PERM : TEMPLATE_PERM;
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
  if (error instanceof SamisHttpError && error.code === CLINICAL_CONFLICT_CODE) {
    throw new ClinicalConflictError();
  }
  throw error;
}

export async function loadClinicalDictionary(entity: ClinicalEntity, params: { allStatus?: boolean } = {}): Promise<Record<string, unknown>[]> {
  const raw = await anesthesiaDictApi.getClinicalDictionary(entity, params);
  return unwrapDictListPayload<Record<string, unknown>>(unwrap(raw));
}

export async function getClinicalDictionaryDetail(entity: ClinicalEntity, id: number): Promise<Record<string, unknown> | null> {
  const raw = await anesthesiaDictApi.getClinicalDictionaryDetail(entity, id);
  const data = unwrap(raw);
  if (!data || (typeof data === 'object' && Object.keys(data as object).length === 0)) return null;
  return data as Record<string, unknown>;
}

export async function saveClinicalDictionary(payload: Record<string, unknown>): Promise<{ id?: number; version: number }> {
  try {
    const result = await anesthesiaDictApi.saveClinicalDictionary(payload);
    const data = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
    return { id: data.id === undefined ? undefined : Number(data.id), version: Number(data.version ?? 0) };
  } catch (error) {
    throwIfConflict(error);
  }
}

export async function changeClinicalDictionaryStatus(payload: Record<string, unknown>): Promise<{ status: string; version: number }> {
  try {
    const result = await anesthesiaDictApi.changeClinicalDictionaryStatus(payload);
    const data = (result && typeof result === 'object' ? result : {}) as Record<string, unknown>;
    return { status: String(data.status ?? ''), version: Number(data.version ?? 0) };
  } catch (error) {
    throwIfConflict(error);
  }
}

export async function loadClinicalDictionaryHistory(entity: ClinicalEntity, id: number): Promise<Record<string, unknown>[]> {
  const raw = await anesthesiaDictApi.clinicalDictionaryHistory(entity, id);
  return unwrapDictListPayload<Record<string, unknown>>(unwrap(raw));
}

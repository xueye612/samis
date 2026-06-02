import type { MedicationRecord } from '@/types/anesthesia';
import type { DrugDictItem } from '@/types/system';
import type { DrugRecommendResponse, SpecialDrugCategory } from '@/types/drugDict';
import { normalizeMedicationMode, type MedicationModeLabel } from '@/services/medicationDisplayRules';

const MODE_API: Record<MedicationModeLabel, DrugRecommendResponse['recommendMode']> = {
  单次用药: 'single',
  持续泵入: 'continuous',
  间断追加: 'intermittent',
};

export function findDrugByName(drugs: DrugDictItem[], name?: string): DrugDictItem | undefined {
  if (!name?.trim()) return undefined;
  return drugs.find((item) => item.enabled && item.name === name);
}

export function buildDrugRecommendFromDict(drug: DrugDictItem): DrugRecommendResponse {
  const mode = drug.defaultMode ?? '单次用药';
  return {
    drugId: drug.id,
    drugName: drug.name,
    recommendMode: MODE_API[mode],
    recommendIsSpecial: Boolean(drug.defaultIsSpecial),
    specialCategory: drug.specialCategory,
    reasonTemplate: drug.specialReasonTemplate,
    allowManualOverride: drug.allowManualOverride !== false,
  };
}

export interface MedicationLineRecommendPatch {
  drugId?: string;
  mode?: MedicationRecord['mode'];
  isSpecial: boolean;
  specialCategory?: SpecialDrugCategory;
  specialReason: string;
  route?: string;
  unit?: string;
  highAlert?: boolean;
  recommendIsSpecial: boolean;
  allowManualOverride: boolean;
}

/**
 * 根据药品字典生成弹窗推荐值。
 * 若医生已手动改过 is_special（userTouchedIsSpecial），则保留当前勾选，仅更新非冲突字段。
 */
export function buildMedicationLineRecommendPatch(
  drug: DrugDictItem,
  options: {
    currentIsSpecial?: boolean;
    userTouchedIsSpecial?: boolean;
    preserveMode?: boolean;
    currentMode?: MedicationRecord['mode'];
  } = {},
): MedicationLineRecommendPatch {
  const recommend = buildDrugRecommendFromDict(drug);
  const isSpecial = options.userTouchedIsSpecial
    ? Boolean(options.currentIsSpecial)
    : recommend.recommendIsSpecial;
  return {
    drugId: drug.id,
    mode: options.preserveMode && options.currentMode
      ? normalizeMedicationMode(options.currentMode)
      : (drug.defaultMode ?? '单次用药'),
    isSpecial,
    specialCategory: drug.specialCategory,
    specialReason: isSpecial ? (drug.specialReasonTemplate ?? '') : '',
    route: drug.defaultRoute,
    unit: drug.doseUnit,
    highAlert: Boolean(drug.highAlert),
    recommendIsSpecial: recommend.recommendIsSpecial,
    allowManualOverride: recommend.allowManualOverride,
  };
}

export function resolveMedicationSpecialReason(record: Pick<MedicationRecord, 'specialReason' | 'reason'>): string {
  return (record.specialReason ?? record.reason ?? '').trim();
}

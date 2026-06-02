import type { ApiDrugDictItem } from '@/types/drugDict';
import type { DrugDictItem } from '@/types/system';
import { normalizeMedicationMode } from '@/services/medicationDisplayRules';

const API_MODE_TO_LABEL = {
  single: '单次用药',
  intermittent: '间断追加',
  continuous: '持续泵入',
} as const;

const LABEL_TO_API_MODE = {
  单次用药: 'single',
  间断追加: 'intermittent',
  持续泵入: 'continuous',
} as const;

export function drugDictItemToApi(item: DrugDictItem): ApiDrugDictItem {
  const mode = item.defaultMode ? LABEL_TO_API_MODE[item.defaultMode] : undefined;
  return {
    drugId: item.id,
    drugCode: item.code,
    drugName: item.name,
    drugAlias: item.drugAlias ?? item.code,
    drugCategory: item.drugCategory,
    defaultMode: mode,
    defaultRoute: item.defaultRoute,
    defaultDoseUnit: item.doseUnit,
    defaultRateUnit: item.defaultRateUnit,
    defaultIsSpecial: Boolean(item.defaultIsSpecial),
    specialCategory: item.specialCategory,
    specialReasonTemplate: item.specialReasonTemplate,
    specialDisplayTemplate: item.specialDisplayTemplate,
    allowManualOverride: item.allowManualOverride !== false,
    isHighAlert: Boolean(item.highAlert),
    isRescueDrug: Boolean(item.isRescueDrug),
    isVasoactive: Boolean(item.isVasoactive),
    isAnticoagulant: Boolean(item.isAnticoagulant),
    isObstetricDrug: Boolean(item.isObstetricDrug),
    isElectrolyteDrug: Boolean(item.isElectrolyteDrug),
    enabled: item.enabled,
    sortOrder: item.sortOrder,
    remark: item.remark,
    specification: item.specification,
    defaultDose: item.defaultDose,
  };
}

export function apiDrugDictToItem(row: ApiDrugDictItem): DrugDictItem {
  const modeLabel = row.defaultMode ? API_MODE_TO_LABEL[row.defaultMode] : undefined;
  return {
    id: row.drugId,
    code: row.drugCode,
    name: row.drugName,
    drugAlias: row.drugAlias,
    drugCategory: row.drugCategory,
    specification: row.specification ?? '',
    doseUnit: row.defaultDoseUnit ?? '',
    defaultRoute: row.defaultRoute,
    defaultDose: row.defaultDose,
    defaultRateUnit: row.defaultRateUnit,
    defaultMode: modeLabel ? normalizeMedicationMode(modeLabel) : undefined,
    defaultIsSpecial: row.defaultIsSpecial,
    specialCategory: row.specialCategory,
    specialReasonTemplate: row.specialReasonTemplate,
    specialDisplayTemplate: row.specialDisplayTemplate,
    allowManualOverride: row.allowManualOverride,
    highAlert: row.isHighAlert,
    isRescueDrug: row.isRescueDrug,
    isVasoactive: row.isVasoactive,
    isAnticoagulant: row.isAnticoagulant,
    isObstetricDrug: row.isObstetricDrug,
    isElectrolyteDrug: row.isElectrolyteDrug,
    enabled: row.enabled !== false,
    sortOrder: row.sortOrder,
    remark: row.remark,
    common: true,
  };
}

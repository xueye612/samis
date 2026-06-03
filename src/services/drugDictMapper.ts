import type { ApiDrugDictItem } from '@/types/drugDict';
import type { DrugDictItem } from '@/types/system';
import { pickField, pickNumber, pickString } from '@/services/anesthesia/adapters/fieldUtils';
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

function normalizeApiMode(raw: unknown): ApiDrugDictItem['defaultMode'] | undefined {
  const text = String(raw ?? '').trim().toLowerCase();
  if (text === 'single' || text === '单次' || text === '单次用药') return 'single';
  if (text === 'intermittent' || text === '间断' || text === '间断追加') return 'intermittent';
  if (text === 'continuous' || text === '持续' || text === '持续泵入' || text === '泵注') return 'continuous';
  return undefined;
}

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

/** 兼容后端 camelCase / snake_case 字段，避免映射后 name 为空被整表滤掉 */
export function apiDrugDictToItem(row: ApiDrugDictItem | Record<string, unknown>): DrugDictItem {
  const raw = row as Record<string, unknown>;
  const mode = normalizeApiMode(pickField(raw, ['defaultMode', 'default_mode']));
  const modeLabel = mode ? API_MODE_TO_LABEL[mode] : undefined;
  const enabledRaw = pickField(raw, ['enabled']);
  return {
    id: pickString(raw, ['drugId', 'drug_id', 'id'], ''),
    code: pickString(raw, ['drugCode', 'drug_code', 'code'], ''),
    name: pickString(raw, ['drugName', 'drug_name', 'name'], ''),
    drugAlias: pickString(raw, ['drugAlias', 'drug_alias'], ''),
    drugCategory: pickString(raw, ['drugCategory', 'drug_category'], ''),
    specification: pickString(raw, ['specification', 'spec'], ''),
    doseUnit: pickString(raw, ['defaultDoseUnit', 'default_dose_unit', 'doseUnit', 'dose_unit'], ''),
    defaultRoute: pickString(raw, ['defaultRoute', 'default_route'], ''),
    defaultDose: pickField(raw, ['defaultDose', 'default_dose']) as number | string | undefined,
    defaultRateUnit: pickString(raw, ['defaultRateUnit', 'default_rate_unit'], ''),
    defaultMode: modeLabel ? normalizeMedicationMode(modeLabel) : undefined,
    defaultIsSpecial: Boolean(pickField(raw, ['defaultIsSpecial', 'default_is_special'])),
    specialCategory: pickField(raw, ['specialCategory', 'special_category']) as DrugDictItem['specialCategory'],
    specialReasonTemplate: pickString(raw, ['specialReasonTemplate', 'special_reason_template'], ''),
    specialDisplayTemplate: pickString(raw, ['specialDisplayTemplate', 'special_display_template'], ''),
    allowManualOverride: pickField(raw, ['allowManualOverride', 'allow_manual_override']) !== false,
    highAlert: Boolean(pickField(raw, ['isHighAlert', 'is_high_alert', 'highAlert', 'high_alert'])),
    isRescueDrug: Boolean(pickField(raw, ['isRescueDrug', 'is_rescue_drug'])),
    isVasoactive: Boolean(pickField(raw, ['isVasoactive', 'is_vasoactive'])),
    isAnticoagulant: Boolean(pickField(raw, ['isAnticoagulant', 'is_anticoagulant'])),
    isObstetricDrug: Boolean(pickField(raw, ['isObstetricDrug', 'is_obstetric_drug'])),
    isElectrolyteDrug: Boolean(pickField(raw, ['isElectrolyteDrug', 'is_electrolyte_drug'])),
    enabled: enabledRaw === undefined ? true : Boolean(enabledRaw),
    sortOrder: pickNumber(raw, ['sortOrder', 'sort_order'], 99),
    remark: pickString(raw, ['remark'], ''),
    common: true,
  };
}

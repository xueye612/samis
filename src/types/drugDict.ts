/** 特殊用药分类（字典 / 保存接口） */
export type SpecialDrugCategory =
  | 'vasoactive'
  | 'rescue'
  | 'hemodynamic'
  | 'anticoagulant'
  | 'obstetric'
  | 'electrolyte'
  | 'allergy'
  | 'other';

export const SPECIAL_DRUG_CATEGORY_OPTIONS: Array<{ value: SpecialDrugCategory; label: string }> = [
  { value: 'vasoactive', label: '血管活性药' },
  { value: 'rescue', label: '抢救药' },
  { value: 'hemodynamic', label: '血压/心率处理' },
  { value: 'anticoagulant', label: '抗凝/抗凝拮抗' },
  { value: 'obstetric', label: '产科特殊用药' },
  { value: 'electrolyte', label: '电解质/内环境处理' },
  { value: 'allergy', label: '抗过敏/激素处理' },
  { value: 'other', label: '其他' },
];

/** 后端 getDrugDict 单条（camelCase） */
export interface ApiDrugDictItem {
  drugId: string;
  drugCode: string;
  drugName: string;
  drugAlias?: string;
  drugCategory?: string;
  defaultMode?: 'single' | 'intermittent' | 'continuous';
  defaultRoute?: string;
  defaultDoseUnit?: string;
  defaultRateUnit?: string;
  defaultIsSpecial?: boolean;
  specialCategory?: SpecialDrugCategory;
  specialReasonTemplate?: string;
  specialDisplayTemplate?: string;
  allowManualOverride?: boolean;
  isHighAlert?: boolean;
  isRescueDrug?: boolean;
  isVasoactive?: boolean;
  isAnticoagulant?: boolean;
  isObstetricDrug?: boolean;
  isElectrolyteDrug?: boolean;
  enabled?: boolean;
  sortOrder?: number;
  remark?: string;
  specification?: string;
  defaultDose?: number | string;
}

export interface DrugRecommendResponse {
  drugId: string;
  drugName: string;
  recommendMode: 'single' | 'intermittent' | 'continuous';
  recommendIsSpecial: boolean;
  specialCategory?: SpecialDrugCategory;
  reasonTemplate?: string;
  allowManualOverride: boolean;
}

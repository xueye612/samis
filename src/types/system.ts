import type { SpecialDrugCategory } from '@/types/drugDict';

export interface AuditLogEntry {
  id: string;
  time: string;
  user: string;
  module: string;
  action: string;
  target: string;
  detail: string;
}

export interface IntegrationEndpoint {
  id: string;
  name: string;
  endpoint: string;
  status: 'connected' | 'simulated' | 'disabled';
  lastSync: string;
  description: string;
}

export interface SystemUser {
  id: string;
  username: string;
  name: string;
  /** 真实模式=角色组 groupid(number)；mock 模式=本地枚举('admin'|'anesthesiologist'|'nurse'|'viewer') */
  role: number | string;
  /** 展示用角色名（可选） */
  roleName?: string;
  department: string;
  active: boolean;
}

export interface QualityReportCache {
  period: string;
  hospitalId: string;
  generatedAt: string;
  indicatorCount: number;
  defectCount: number;
  exportFormat: 'excel' | 'pdf';
}

export interface TodoItem {
  id: string;
  title: string;
  category: '访视' | '缺陷' | 'PACU' | '随访' | '不良事件' | '审批';
  caseId?: string;
  priority: '高' | '中' | '低';
  dueTime?: string;
  status: '待处理' | '处理中' | '已完成';
}

export interface PdcaRecord {
  id: string;
  title: string;
  indicatorCode?: string;
  problem: string;
  plan: string;
  doAction: string;
  checkResult: string;
  actSummary: string;
  owner: string;
  status: '进行中' | '已完成';
  updatedAt: string;
}

export interface DictItem {
  id: string;
  code: string;
  name: string;
  category?: string;
  enabled: boolean;
  remark?: string;
}

export interface AnesthesiaMethodItem {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
}

export interface AnesthesiaMethodCategory {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  children: AnesthesiaMethodItem[];
}

export interface DrugDictItem extends DictItem {
  doseUnit: string;
  specification: string;
  drugAlias?: string;
  /** 药理/业务分类（非 special_category） */
  drugCategory?: string;
  defaultRoute?: string;
  defaultDose?: number | string;
  defaultRateUnit?: string;
  defaultMode?: '单次用药' | '持续泵入' | '间断追加';
  /** 是否默认推荐勾选特殊用药；医生可覆盖 */
  defaultIsSpecial?: boolean;
  specialCategory?: SpecialDrugCategory;
  specialReasonTemplate?: string;
  specialDisplayTemplate?: string;
  allowManualOverride?: boolean;
  highAlert?: boolean;
  isRescueDrug?: boolean;
  isVasoactive?: boolean;
  isAnticoagulant?: boolean;
  isObstetricDrug?: boolean;
  isElectrolyteDrug?: boolean;
  common?: boolean;
  sortOrder?: number;
  remark?: string;
}

export type FluidBloodSubCategory = '晶体液' | '胶体液' | '血液制品' | '自体血回输';

export interface FluidBloodDictItem extends DictItem {
  subCategory: FluidBloodSubCategory;
  defaultUnit?: string;
  defaultVolume?: number;
  requiresDoubleCheck?: boolean;
}

export interface VitalSignDictItem extends DictItem {
  shortCode: string;
  unit: string;
  normalRange?: string;
  lowerLimit?: number;
  upperLimit?: number;
  defaultValue?: number | string;
  chartEnabled?: boolean;
  chartColor?: string;
  chartSymbol?: 'triangle-down' | 'triangle-up' | 'circle' | 'hollow-circle' | 'diamond' | 'star' | 'square' | 'text';
  decimalPlaces?: number;
  sortOrder: number;
}

export type GenericDictKey =
  | 'bloodTypes'
  | 'rhTypes'
  | 'transfusionReactions'
  | 'airwayMethods'
  | 'intubationMethods'
  | 'extubationStatuses'
  | 'transferDestinations'
  | 'collectStatuses'
  | 'recordStatuses'
  | 'frequencyOptions';

/** 打印模板字典项（ConfigPrint）。向后兼容历史 string[]。 */
export interface PrintTemplateItem {
  id: string;
  templateCode?: string;
  templateName: string;
  templateType?: string;
  isDefault?: boolean;
  enabled: boolean;
  remark?: string;
}

/** 麻醉人员字典项（ConfigStaff）。向后兼容历史 string[]（仅 name）。 */
export type StaffRole = '麻醉医生' | '麻醉护士' | string;

export interface StaffDictItem {
  id: string;
  gh?: string;
  name: string;
  title?: string;
  departmentCode?: string;
  departmentName?: string;
  role?: StaffRole;
  schedulingWeight?: number;
  sortOrder?: number;
  enabled: boolean;
  remark?: string;
}

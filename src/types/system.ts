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
  role: 'admin' | 'anesthesiologist' | 'nurse' | 'viewer';
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
  defaultRoute?: string;
  defaultDose?: number | string;
  defaultMode?: '单次用药' | '持续泵入';
  highAlert?: boolean;
  common?: boolean;
  sortOrder?: number;
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

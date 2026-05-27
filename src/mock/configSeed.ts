import type {
  AnesthesiaMethodCategory,
  DrugDictItem,
  FluidBloodDictItem,
  VitalSignDictItem,
} from '@/types/system';

function methodChild(id: string, code: string, name: string) {
  return { id, code, name, enabled: true };
}

export const seedMethodCategories: AnesthesiaMethodCategory[] = [
  {
    id: 'method-cat-ga',
    code: 'GA',
    name: '全身麻醉',
    enabled: true,
    children: [
      methodChild('method-ga-1', 'GA-FI', '快诱导'),
      methodChild('method-ga-2', 'GA-SI', '慢诱导'),
      methodChild('method-ga-3', 'GA-INH', '吸入维持'),
      methodChild('method-ga-4', 'GA-TIVA', 'TIVA'),
      methodChild('method-ga-5', 'GA-LMA', '喉罩全麻'),
    ],
  },
  {
    id: 'method-cat-neuraxial',
    code: 'NEURAXIAL',
    name: '椎管内麻醉',
    enabled: true,
    children: [
      methodChild('method-neu-1', 'NEU-SA', '腰麻'),
      methodChild('method-neu-2', 'NEU-EA', '硬膜外'),
      methodChild('method-neu-3', 'NEU-CSE', '腰硬联合'),
      methodChild('method-neu-4', 'NEU-CA', '骶管阻滞'),
    ],
  },
  {
    id: 'method-cat-regional',
    code: 'REGIONAL',
    name: '区域阻滞',
    enabled: true,
    children: [
      methodChild('method-reg-1', 'REG-BPB', '臂丛阻滞'),
      methodChild('method-reg-2', 'REG-CPB', '颈丛阻滞'),
      methodChild('method-reg-3', 'REG-TAP', '腹横肌平面阻滞'),
      methodChild('method-reg-4', 'REG-SNB', '坐骨神经阻滞'),
    ],
  },
  {
    id: 'method-cat-mac',
    code: 'MAC',
    name: 'MAC',
    enabled: true,
    children: [
      methodChild('method-mac-1', 'MAC-PRO', '丙泊酚镇静'),
      methodChild('method-mac-2', 'MAC-DEX', '右美托咪定镇静'),
    ],
  },
  {
    id: 'method-cat-local',
    code: 'LOCAL',
    name: '局麻监护',
    enabled: true,
    children: [
      methodChild('method-loc-1', 'LOC-INF', '局部浸润+监护'),
      methodChild('method-loc-2', 'LOC-TOP', '表面麻醉+监护'),
    ],
  },
];

function drug(
  id: string,
  code: string,
  name: string,
  specification: string,
  doseUnit: string,
  defaultRoute: string,
  defaultDose?: number | string,
  highAlert = false,
  common = true,
  sortOrder = 99,
): DrugDictItem {
  return { id, code, name, specification, doseUnit, defaultRoute, defaultDose, highAlert, common, sortOrder, enabled: true };
}

export const seedDrugDict: DrugDictItem[] = [
  drug('drug-1', 'PROP', '丙泊酚', '200mg/20ml', 'mg', '静脉', 120, true, true, 1),
  drug('drug-2', 'FENT', '芬太尼', '0.1mg/2ml', 'μg', '静脉', 100, true, true, 2),
  drug('drug-3', 'SUF', '舒芬太尼', '50μg/1ml', 'μg', '静脉', 20, true, true, 3),
  drug('drug-4', 'REMI', '瑞芬太尼', '1mg/1ml', 'μg/kg·min', '泵入', 0.1, true, true, 4),
  drug('drug-5', 'ROC', '罗库溴铵', '50mg/5ml', 'mg', '静脉', 50, false, true, 5),
  drug('drug-6', 'CIS', '顺阿曲库铵', '10mg/5ml', 'mg', '静脉', 10, false, true, 6),
  drug('drug-7', 'SEV', '七氟烷', '250ml/瓶', '%', '吸入', 2, false, true, 7),
  drug('drug-8', 'NE', '去甲肾上腺素', '2mg/1ml', 'μg/min', '泵入', 8, true, true, 8),
  drug('drug-9', 'ATR', '阿托品', '0.5mg/1ml', 'mg', '静脉', 0.5, false, true, 9),
  drug('drug-10', 'EPI', '肾上腺素', '1mg/1ml', 'mg', '静脉', 0.1, true, true, 10),
  drug('drug-11', 'DEX', '右美托咪定', '200μg/2ml', 'μg/kg·h', '泵入', 0.4, true, true, 11),
  drug('drug-12', 'EPH', '麻黄碱', '30mg/1ml', 'mg', '静脉', 6, false, true, 12),
];

function fluid(
  id: string,
  code: string,
  name: string,
  subCategory: FluidBloodDictItem['subCategory'],
  defaultUnit = 'ml',
  remark?: string,
  defaultVolume?: number,
  requiresDoubleCheck?: boolean,
): FluidBloodDictItem {
  return { id, code, name, subCategory, defaultUnit, remark, defaultVolume, requiresDoubleCheck, enabled: true };
}

export const seedFluidBloodDict: FluidBloodDictItem[] = [
  fluid('fluid-1', 'LR', '乳酸钠林格液', '晶体液', 'ml', undefined, 500, false),
  fluid('fluid-2', 'NS', '0.9%氯化钠', '晶体液', 'ml', undefined, 500, false),
  fluid('fluid-3', 'GS5', '5%葡萄糖', '晶体液', 'ml', undefined, 500, false),
  fluid('fluid-4', 'HES', '羟乙基淀粉130/0.4', '胶体液', 'ml', undefined, 500, false),
  fluid('fluid-5', 'GEL', '琥珀酰明胶', '胶体液', 'ml', undefined, 500, false),
  fluid('fluid-6', 'RBC', '悬浮红细胞', '血液制品', 'U', '需交叉配血', 2, true),
  fluid('fluid-7', 'FFP', '新鲜冰冻血浆', '血液制品', 'ml', '需交叉配血', 300, true),
  fluid('fluid-8', 'PLT', '血小板', '血液制品', '治疗量', '需交叉配血', 1, true),
  fluid('fluid-10', 'CRYO', '冷沉淀', '血液制品', 'U', '需交叉配血', 10, true),
  fluid('fluid-9', 'AUTO', '自体血回输', '自体血回输', 'ml', undefined, 300, false),
];

export const seedVitalSignDict: VitalSignDictItem[] = [
  { id: 'vital-1', code: 'V-HR', name: '心率 HR', shortCode: 'HR', unit: 'bpm', normalRange: '50-120', lowerLimit: 50, upperLimit: 120, defaultValue: 80, chartEnabled: true, chartColor: '#16a34a', chartSymbol: 'circle', decimalPlaces: 0, sortOrder: 1, enabled: true },
  { id: 'vital-2', code: 'V-SBP', name: '收缩压 SBP', shortCode: 'SBP', unit: 'mmHg', normalRange: '90-160', lowerLimit: 90, upperLimit: 160, defaultValue: 120, chartEnabled: true, chartColor: '#dc2626', chartSymbol: 'triangle-down', decimalPlaces: 0, sortOrder: 2, enabled: true },
  { id: 'vital-3', code: 'V-DBP', name: '舒张压 DBP', shortCode: 'DBP', unit: 'mmHg', normalRange: '50-100', lowerLimit: 50, upperLimit: 100, defaultValue: 70, chartEnabled: true, chartColor: '#dc2626', chartSymbol: 'triangle-up', decimalPlaces: 0, sortOrder: 3, enabled: true },
  { id: 'vital-4', code: 'V-MAP', name: '平均动脉压 MAP', shortCode: 'MAP', unit: 'mmHg', normalRange: '70-105', lowerLimit: 70, upperLimit: 105, defaultValue: 85, chartEnabled: false, chartColor: '#ef4444', chartSymbol: 'square', decimalPlaces: 0, sortOrder: 4, enabled: false },
  { id: 'vital-5', code: 'V-SPO2', name: '血氧饱和度 SpO2', shortCode: 'SpO2', unit: '%', normalRange: '95-100', lowerLimit: 95, defaultValue: 99, chartEnabled: true, chartColor: '#2563eb', chartSymbol: 'diamond', decimalPlaces: 0, sortOrder: 5, enabled: true },
  { id: 'vital-6', code: 'V-RR', name: '呼吸频率 RR', shortCode: 'RR', unit: '次/分', normalRange: '8-25', lowerLimit: 8, upperLimit: 25, defaultValue: 14, chartEnabled: true, chartColor: '#2563eb', chartSymbol: 'hollow-circle', decimalPlaces: 0, sortOrder: 6, enabled: true },
  { id: 'vital-7', code: 'V-ETCO2', name: '呼气末 CO2 EtCO2', shortCode: 'EtCO2', unit: 'mmHg', normalRange: '30-45', lowerLimit: 30, upperLimit: 45, defaultValue: 36, chartEnabled: false, chartColor: '#7c3aed', chartSymbol: 'text', decimalPlaces: 0, sortOrder: 7, enabled: true },
  { id: 'vital-8', code: 'V-TEMP', name: '体温 TEMP', shortCode: 'TEMP', unit: '℃', normalRange: '35.5-38.5', lowerLimit: 35.5, upperLimit: 38.5, defaultValue: 36.4, chartEnabled: true, chartColor: '#16a34a', chartSymbol: 'square', decimalPlaces: 1, sortOrder: 8, enabled: true },
  { id: 'vital-9', code: 'V-BIS', name: '脑电双频指数 BIS', shortCode: 'BIS', unit: '—', normalRange: '40-60', lowerLimit: 40, upperLimit: 60, defaultValue: 50, chartEnabled: false, chartColor: '#9333ea', chartSymbol: 'text', decimalPlaces: 0, sortOrder: 9, enabled: true },
  { id: 'vital-10', code: 'V-CVP', name: '中心静脉压 CVP', shortCode: 'CVP', unit: 'cmH2O', normalRange: '5-12', lowerLimit: 5, upperLimit: 12, defaultValue: 8, chartEnabled: false, chartColor: '#0891b2', chartSymbol: 'text', decimalPlaces: 0, sortOrder: 10, enabled: false },
];

export const FLUID_BLOOD_SUB_CATEGORIES = ['晶体液', '胶体液', '血液制品', '自体血回输'] as const;
export const seedBloodTypes = ['A', 'B', 'O', 'AB'] as const;
export const seedRhTypes = ['Rh+', 'Rh-'] as const;
export const seedTransfusionReactions = ['无', '发热', '寒战', '皮疹', '低血压', '呼吸困难'] as const;
export const seedAirwayMethods = ['面罩通气', '喉罩', '气管插管', '双腔管', '气管切开', '其他'] as const;
export const seedIntubationMethods = ['直接喉镜', '视频喉镜', '纤支镜', '快速诱导', '清醒插管'] as const;
export const seedExtubationStatuses = ['顺利', '呛咳', '喉痉挛', '低氧', '延迟拔管', '带管入 PACU/ICU'] as const;
export const seedTransferDestinations = ['PACU', 'ICU', '病房', '门诊', '其他'] as const;
export const seedCollectStatuses = ['未连接', '待启动', '采集中', '采集暂停', '采集异常', '已结束'] as const;
export const seedRecordStatuses = ['草稿', '记录中', '待签名', '已签名', '待归档', '已归档', '抢救中', '修改中'] as const;
export const seedFrequencyOptions = ['1分钟', '3分钟', '5分钟', '10分钟', '15分钟'] as const;

export function flattenMethodOptions(categories: AnesthesiaMethodCategory[]) {
  const options: { label: string; value: string; category: string }[] = [];
  categories.forEach((cat) => {
    if (!cat.enabled) return;
    cat.children.forEach((child) => {
      if (child.enabled) options.push({ label: `${cat.name} / ${child.name}`, value: child.name, category: cat.name });
    });
  });
  return options;
}

export function enabledDrugs(items: DrugDictItem[]) {
  return items.filter((item) => item.enabled);
}

export function fluidsBySubCategory(items: FluidBloodDictItem[], subCategory: FluidBloodDictItem['subCategory']) {
  return items.filter((item) => item.enabled && item.subCategory === subCategory);
}

export function enabledVitalSigns(items: VitalSignDictItem[]) {
  return [...items].filter((item) => item.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
}

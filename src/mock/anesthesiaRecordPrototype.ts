import type { EventStage, Severity } from '@/types/anesthesia';

export type AnesthesiaMethodKey = 'general' | 'neuraxial' | 'nerveBlock' | 'local' | 'sedation';

export interface AnesthesiaMethodOption {
  key: AnesthesiaMethodKey;
  label: string;
  shortLabel: string;
  description: string;
}

export interface AnesthesiaTemplateOption {
  name: string;
  primary: AnesthesiaMethodKey;
  auxiliary: AnesthesiaMethodKey[];
  description: string;
}

export interface TemplateImpactEvent {
  name: string;
  time: string;
  stage: EventStage;
  severity: Severity;
  note: string;
}

export interface TemplateImpactMedication {
  drug: string;
  time: string;
  dose?: number;
  unit?: string;
  route?: string;
  mode?: '单次用药' | '持续泵入';
  endTime?: string;
  pumpRate?: string;
}

export interface TemplateImpactField {
  group: string;
  label: string;
  value: string;
  method: AnesthesiaMethodKey;
}

export interface TemplateQualityTip {
  level: '提示' | '关注' | '预警';
  text: string;
}

export interface TemplateImpact {
  events: TemplateImpactEvent[];
  medications: TemplateImpactMedication[];
  monitorCodes: string[];
  professionalFields: TemplateImpactField[];
  qualityTips: TemplateQualityTip[];
}

export type IntraopStage = '入室后' | '诱导期' | '术中' | '苏醒期' | '离室';
export type LandingItemKind = 'event' | 'medication' | 'monitor' | 'field';
export type LandingItemStatus = 'pending' | 'confirmed';
export type SurgeryScenarioKey = 'generalSurgery' | 'laparoscopic' | 'cesarean' | 'orthopedic' | 'thoracic' | 'ambulatoryMinor' | 'endoscopy' | 'neurosurgery';

export interface TemplateLandingItem {
  landingId: string;
  kind: LandingItemKind;
  status: LandingItemStatus;
  sourceTemplate: string;
  label: string;
  value: string;
  relatedEventName?: string;
  event?: TemplateImpactEvent;
  medication?: TemplateImpactMedication;
  monitorCode?: string;
  field?: TemplateImpactField;
}

export interface CompletionGap {
  id: string;
  level: '提示' | '关注' | '预警';
  text: string;
  relatedEventName?: string;
}

export interface SurgeryScenarioOption {
  key: SurgeryScenarioKey;
  label: string;
  description: string;
  tags: string[];
}

export type WorkflowGuidanceKind = 'recommendation' | 'risk' | 'nextStep';

export interface WorkflowGuidanceRule {
  id: string;
  kind: WorkflowGuidanceKind;
  level: '提示' | '关注' | '预警';
  text: string;
  stages?: IntraopStage[];
  methods?: AnesthesiaMethodKey[];
  scenarios?: SurgeryScenarioKey[];
  requiresAnyEvent?: string[];
  excludesAnyEvent?: string[];
  focusModuleKeys?: AnesthesiaMethodKey[];
}

export interface DynamicModuleItem {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface DynamicModuleSection {
  title: string;
  items: DynamicModuleItem[];
}

export interface DynamicModuleEntry {
  key: AnesthesiaMethodKey;
  title: string;
  summary: string;
  accent: string;
  sections: DynamicModuleSection[];
}

export interface QuickEventOption {
  name: string;
  stage: EventStage;
  severity: Severity;
  treatment?: string;
  syncField?: 'anesthesiaStart' | 'surgeryStart' | 'surgeryEnd' | 'anesthesiaEnd' | 'leaveRoomTime' | 'roomInTime';
}

export const anesthesiaMethodOptions: AnesthesiaMethodOption[] = [
  { key: 'general', label: '全身麻醉', shortLabel: '全麻', description: '气道、呼吸机、麻醉深度、肌松与苏醒拔管。' },
  { key: 'neuraxial', label: '椎管内麻醉', shortLabel: '椎管内', description: '穿刺、置管、椎管内用药、麻醉平面与运动阻滞。' },
  { key: 'nerveBlock', label: '神经阻滞', shortLabel: '神经阻滞', description: '阻滞部位、侧别、引导方式、阻滞范围与效果。' },
  { key: 'local', label: '局部麻醉', shortLabel: '局麻', description: '局麻部位、局麻药、剂量、效果和不良反应。' },
  { key: 'sedation', label: '镇静/监护麻醉', shortLabel: '镇静/MAC', description: '镇静程度、氧疗、呼吸状态、镇静药物与不良反应。' },
];

export const anesthesiaTemplateOptions: AnesthesiaTemplateOption[] = [
  { name: '全麻-气管插管', primary: 'general', auxiliary: [], description: '全麻主流程，气管插管管理。' },
  { name: '全麻-喉罩', primary: 'general', auxiliary: [], description: '全麻主流程，喉罩气道管理。' },
  { name: '全麻-静吸复合', primary: 'general', auxiliary: [], description: '静脉诱导联合吸入维持。' },
  { name: '全麻-全凭静脉', primary: 'general', auxiliary: [], description: 'TIVA，全程静脉泵注维持。' },
  { name: '腰麻', primary: 'neuraxial', auxiliary: [], description: '蛛网膜下腔麻醉与平面观察。' },
  { name: '硬膜外', primary: 'neuraxial', auxiliary: [], description: '硬膜外穿刺置管和分次给药。' },
  { name: '腰硬联合', primary: 'neuraxial', auxiliary: [], description: '腰麻起效联合硬膜外置管。' },
  { name: '臂丛神经阻滞', primary: 'nerveBlock', auxiliary: [], description: '超声引导臂丛阻滞。' },
  { name: '全麻 + 神经阻滞', primary: 'general', auxiliary: ['nerveBlock'], description: '全麻联合区域镇痛。' },
  { name: '全麻 + 硬膜外', primary: 'general', auxiliary: ['neuraxial'], description: '全麻联合硬膜外镇痛或阻滞。' },
  { name: '镇静 + 局麻', primary: 'sedation', auxiliary: ['local'], description: 'MAC 镇静联合局部浸润。' },
];

export const intraopStageOptions: IntraopStage[] = ['入室后', '诱导期', '术中', '苏醒期', '离室'];

export const surgeryScenarioOptions: SurgeryScenarioOption[] = [
  { key: 'generalSurgery', label: '普通手术', description: '常规手术室内麻醉记录流程。', tags: ['常规', '普外'] },
  { key: 'laparoscopic', label: '腹腔镜', description: '关注气腹后气道压、EtCO2、循环和体温。', tags: ['气腹', 'EtCO2', '体温'] },
  { key: 'cesarean', label: '剖宫产', description: '关注椎管内阻滞、母体循环、胎儿娩出和产科出血。', tags: ['产科', '胎儿娩出', '出血'] },
  { key: 'orthopedic', label: '骨科', description: '关注神经阻滞、止血带、失血和深静脉风险。', tags: ['止血带', '神经阻滞'] },
  { key: 'thoracic', label: '胸科', description: '关注单肺通气、氧合、气道压和肺复张。', tags: ['单肺通气', '氧合'] },
  { key: 'ambulatoryMinor', label: '门诊短小手术', description: '关注快速周转、镇静深度、离室评分。', tags: ['日间', '快速苏醒'] },
  { key: 'endoscopy', label: '内镜/手术室外', description: '关注镇静、氧疗、呼吸抑制和非手术室环境。', tags: ['手术室外', '镇静', '氧疗'] },
  { key: 'neurosurgery', label: '神经外科', description: '关注颅内压、循环稳定、出入量和转ICU。', tags: ['颅脑', 'ICU'] },
];

const generalIntubationImpact: TemplateImpact = {
  events: [
    { name: '诱导开始', time: '08:10', stage: '诱导期', severity: '轻度', note: '静脉诱导，面罩给氧。' },
    { name: '插管', time: '08:15', stage: '诱导期', severity: '轻度', note: '气管插管一次成功，接麻醉机通气。' },
    { name: '接麻醉机', time: '08:16', stage: '诱导期', severity: '轻度', note: 'VCV模式，EtCO2波形确认。' },
    { name: '拔管', time: '10:05', stage: '苏醒期', severity: '轻度', note: '清醒后拔管，SpO2稳定。' },
  ],
  medications: [
    { drug: '丙泊酚', time: '08:10', dose: 120, unit: 'mg', route: '静脉', mode: '单次用药' },
    { drug: '芬太尼', time: '08:10', dose: 0.2, unit: 'mg', route: '静脉', mode: '单次用药' },
    { drug: '罗库溴铵', time: '08:12', dose: 40, unit: 'mg', route: '静脉', mode: '单次用药' },
    { drug: '瑞芬太尼', time: '08:20', dose: 0, unit: 'mg', route: '静脉', mode: '持续泵入', endTime: '10:00', pumpRate: '8ml/h' },
  ],
  monitorCodes: ['HR', 'SBP', 'DBP', 'SpO2', 'EtCO2', 'TEMP', 'BIS', 'TOF'],
  professionalFields: [
    { method: 'general', group: '气道', label: '气道方式', value: '气管插管' },
    { method: 'general', group: '气道', label: '导管型号', value: '7.0' },
    { method: 'general', group: '通气', label: '呼吸机模式', value: 'VCV' },
    { method: 'general', group: '通气', label: 'EtCO2', value: '36mmHg' },
    { method: 'general', group: '监测', label: 'BIS', value: '45' },
    { method: 'general', group: '监测', label: 'TOF', value: '2/4' },
    { method: 'general', group: '苏醒', label: '拔管/苏醒', value: '清醒，可配合' },
  ],
  qualityTips: [
    { level: '关注', text: '全麻模板已启用，需持续记录EtCO2、体温、BIS/TOF。' },
    { level: '提示', text: '插管与拔管事件已落到记录单事件行。' },
  ],
};

const laryngealMaskImpact: TemplateImpact = {
  ...generalIntubationImpact,
  events: [
    { name: '诱导开始', time: '08:10', stage: '诱导期', severity: '轻度', note: '静脉诱导，保留自主/辅助通气评估。' },
    { name: '喉罩置入', time: '08:14', stage: '诱导期', severity: '轻度', note: '喉罩置入顺利，漏气压满意。' },
    { name: '接麻醉机', time: '08:15', stage: '诱导期', severity: '轻度', note: '通气参数确认，EtCO2波形存在。' },
    { name: '拔除喉罩', time: '10:02', stage: '苏醒期', severity: '轻度', note: '自主呼吸恢复后拔除喉罩。' },
  ],
  professionalFields: [
    { method: 'general', group: '气道', label: '气道方式', value: '喉罩' },
    { method: 'general', group: '气道', label: '喉罩型号', value: 'LMA 4号' },
    { method: 'general', group: '通气', label: '通气方式', value: '辅助/控制通气' },
    { method: 'general', group: '通气', label: 'EtCO2', value: '38mmHg' },
    { method: 'general', group: '监测', label: 'BIS', value: '48' },
    { method: 'general', group: '苏醒', label: '拔除喉罩', value: '呼吸平稳' },
  ],
};

const neuraxialImpact: TemplateImpact = {
  events: [
    { name: '穿刺', time: '08:10', stage: '诱导期', severity: '轻度', note: '左侧卧位，L3-4穿刺。' },
    { name: '给药', time: '08:12', stage: '诱导期', severity: '轻度', note: '椎管内给药完成。' },
    { name: '平面测定', time: '08:22', stage: '术中', severity: '轻度', note: '针刺法测定感觉阻滞平面。' },
  ],
  medications: [
    { drug: '罗哌卡因', time: '08:12', dose: 12, unit: 'mg', route: '椎管内', mode: '单次用药' },
  ],
  monitorCodes: ['HR', 'SBP', 'DBP', 'SpO2', 'RR', 'TEMP'],
  professionalFields: [
    { method: 'neuraxial', group: '穿刺', label: '穿刺体位', value: '左侧卧位' },
    { method: 'neuraxial', group: '穿刺', label: '穿刺间隙', value: 'L3-4' },
    { method: 'neuraxial', group: '穿刺', label: '脑脊液情况', value: '清亮流出' },
    { method: 'neuraxial', group: '用药', label: '椎管内用药', value: '罗哌卡因 0.5% 12mg' },
    { method: 'neuraxial', group: '平面', label: '麻醉平面', value: 'T8，最高T6' },
    { method: 'neuraxial', group: '平面', label: 'Bromage评分', value: '2' },
  ],
  qualityTips: [
    { level: '提示', text: '椎管内麻醉已显示麻醉平面行，需记录平面测定时间。' },
  ],
};

const epiduralImpact: TemplateImpact = {
  ...neuraxialImpact,
  events: [
    { name: '穿刺', time: '08:08', stage: '诱导期', severity: '轻度', note: '硬膜外穿刺成功。' },
    { name: '置管', time: '08:11', stage: '诱导期', severity: '轻度', note: '硬膜外导管置入4cm。' },
    { name: '给药', time: '08:14', stage: '诱导期', severity: '轻度', note: '试验量阴性后分次给药。' },
    { name: '平面测定', time: '08:28', stage: '术中', severity: '轻度', note: '阻滞平面满足手术要求。' },
  ],
  professionalFields: [
    { method: 'neuraxial', group: '穿刺', label: '穿刺体位', value: '左侧卧位' },
    { method: 'neuraxial', group: '穿刺', label: '穿刺间隙', value: 'L2-3' },
    { method: 'neuraxial', group: '置管', label: '置管深度', value: '4cm' },
    { method: 'neuraxial', group: '用药', label: '椎管内用药', value: '罗哌卡因 0.5% 10ml' },
    { method: 'neuraxial', group: '平面', label: '麻醉平面', value: 'T8' },
    { method: 'neuraxial', group: '平面', label: 'Bromage评分', value: '1' },
  ],
};

const nerveBlockImpact: TemplateImpact = {
  events: [
    { name: '定位', time: '08:05', stage: '诱导期', severity: '轻度', note: '超声定位臂丛神经。' },
    { name: '穿刺', time: '08:08', stage: '诱导期', severity: '轻度', note: '超声引导下穿刺。' },
    { name: '给药', time: '08:10', stage: '诱导期', severity: '轻度', note: '局麻药分次注入。' },
    { name: '阻滞评估', time: '08:25', stage: '术中', severity: '轻度', note: '感觉阻滞范围与运动阻滞评估。' },
  ],
  medications: [
    { drug: '罗哌卡因', time: '08:10', dose: 20, unit: 'ml', route: '神经阻滞', mode: '单次用药' },
  ],
  monitorCodes: ['HR', 'SBP', 'DBP', 'SpO2', 'RR'],
  professionalFields: [
    { method: 'nerveBlock', group: '阻滞', label: '阻滞部位', value: '臂丛神经' },
    { method: 'nerveBlock', group: '阻滞', label: '侧别', value: '左侧' },
    { method: 'nerveBlock', group: '引导', label: '引导方式', value: '超声引导' },
    { method: 'nerveBlock', group: '用药', label: '局麻药', value: '罗哌卡因 0.375% 20ml' },
    { method: 'nerveBlock', group: '效果', label: '感觉阻滞范围', value: '左上肢' },
    { method: 'nerveBlock', group: '效果', label: '阻滞效果', value: '完全' },
  ],
  qualityTips: [
    { level: '提示', text: '神经阻滞记录使用阻滞范围和阻滞效果，不使用麻醉平面。' },
  ],
};

const sedationLocalImpact: TemplateImpact = {
  events: [
    { name: '镇静开始', time: '08:10', stage: '诱导期', severity: '轻度', note: '鼻导管吸氧，静脉镇静。' },
    { name: '局麻', time: '08:14', stage: '诱导期', severity: '轻度', note: '切口局部浸润。' },
    { name: '镇静评估', time: '08:30', stage: '术中', severity: '轻度', note: 'Ramsay 3级，自主呼吸稳定。' },
  ],
  medications: [
    { drug: '丙泊酚', time: '08:10', dose: 0, unit: 'mg', route: '静脉', mode: '持续泵入', endTime: '09:40', pumpRate: '6ml/h' },
    { drug: '利多卡因', time: '08:14', dose: 10, unit: 'ml', route: '局部浸润', mode: '单次用药' },
  ],
  monitorCodes: ['HR', 'SBP', 'DBP', 'SpO2', 'RR', 'EtCO2'],
  professionalFields: [
    { method: 'sedation', group: '镇静', label: '镇静药物', value: '丙泊酚泵注' },
    { method: 'sedation', group: '镇静', label: '镇静评分', value: 'Ramsay 3级' },
    { method: 'sedation', group: '呼吸', label: '氧疗方式', value: '鼻导管吸氧' },
    { method: 'sedation', group: '呼吸', label: '呼吸情况', value: '自主呼吸，SpO2 98%' },
    { method: 'local', group: '局麻', label: '局麻药', value: '利多卡因 1% 10ml' },
    { method: 'local', group: '局麻', label: '麻醉效果', value: '满意' },
  ],
  qualityTips: [
    { level: '关注', text: '镇静/监护麻醉建议连续观察SpO2、RR和EtCO2。' },
  ],
};

export const templateImpactMap: Record<string, TemplateImpact> = {
  '全麻-气管插管': generalIntubationImpact,
  '全麻-喉罩': laryngealMaskImpact,
  '全麻-静吸复合': generalIntubationImpact,
  '全麻-全凭静脉': generalIntubationImpact,
  '腰麻': neuraxialImpact,
  '硬膜外': epiduralImpact,
  '腰硬联合': epiduralImpact,
  '臂丛神经阻滞': nerveBlockImpact,
  '全麻 + 神经阻滞': {
    events: [...generalIntubationImpact.events, ...nerveBlockImpact.events.filter((event) => !['穿刺', '给药'].includes(event.name))],
    medications: [...generalIntubationImpact.medications, ...nerveBlockImpact.medications],
    monitorCodes: Array.from(new Set([...generalIntubationImpact.monitorCodes, ...nerveBlockImpact.monitorCodes])),
    professionalFields: [...generalIntubationImpact.professionalFields, ...nerveBlockImpact.professionalFields],
    qualityTips: [...generalIntubationImpact.qualityTips, ...nerveBlockImpact.qualityTips],
  },
  '全麻 + 硬膜外': {
    events: [...epiduralImpact.events, ...generalIntubationImpact.events],
    medications: [...epiduralImpact.medications, ...generalIntubationImpact.medications],
    monitorCodes: Array.from(new Set([...generalIntubationImpact.monitorCodes, ...epiduralImpact.monitorCodes])),
    professionalFields: [...generalIntubationImpact.professionalFields, ...epiduralImpact.professionalFields],
    qualityTips: [...generalIntubationImpact.qualityTips, ...epiduralImpact.qualityTips],
  },
  '镇静 + 局麻': sedationLocalImpact,
};

export const dynamicAnesthesiaModuleEntries: Record<AnesthesiaMethodKey, DynamicModuleEntry> = {
  general: {
    key: 'general',
    title: '全身麻醉模块',
    summary: '气道管理、呼吸机参数、麻醉深度、肌松监测和拔管苏醒。',
    accent: '#165dff',
    sections: [
      {
        title: '气道与插管',
        items: [
          { label: '气道方式', value: '气管插管', emphasis: true },
          { label: '插管时间', value: '08:15' },
          { label: '导管型号', value: '7.0' },
          { label: '插管深度', value: '22cm' },
          { label: '插管次数', value: '1次' },
          { label: '困难气道', value: '否' },
        ],
      },
      {
        title: '呼吸机与监测',
        items: [
          { label: '呼吸机模式', value: 'VCV', emphasis: true },
          { label: '潮气量', value: '500ml' },
          { label: '呼吸频率', value: '12次/分' },
          { label: 'PEEP', value: '5cmH2O' },
          { label: 'EtCO2', value: '36mmHg' },
          { label: 'BIS', value: '45' },
          { label: 'TOF', value: '2/4' },
        ],
      },
      {
        title: '苏醒拔管',
        items: [
          { label: '拔管时间', value: '10:05', emphasis: true },
          { label: '苏醒状态', value: '清醒，可配合' },
        ],
      },
    ],
  },
  neuraxial: {
    key: 'neuraxial',
    title: '椎管内麻醉模块',
    summary: '穿刺置管、椎管内用药、麻醉平面、运动阻滞和并发症观察。',
    accent: '#0f9f9a',
    sections: [
      {
        title: '穿刺与置管',
        items: [
          { label: '具体方式', value: '腰麻', emphasis: true },
          { label: '穿刺时间', value: '08:10' },
          { label: '穿刺体位', value: '左侧卧位' },
          { label: '穿刺间隙', value: 'L3-4' },
          { label: '是否置管', value: '否' },
        ],
      },
      {
        title: '椎管内用药',
        items: [
          { label: '局麻药', value: '罗哌卡因', emphasis: true },
          { label: '浓度', value: '0.5%' },
          { label: '剂量', value: '12mg' },
        ],
      },
      {
        title: '麻醉平面与阻滞',
        items: [
          { label: '感觉阻滞平面', value: 'T8', emphasis: true },
          { label: '左侧平面', value: 'T8' },
          { label: '右侧平面', value: 'T10' },
          { label: '最高阻滞平面', value: 'T6' },
          { label: '平面测定方式', value: '针刺法' },
          { label: 'Bromage评分', value: '2' },
          { label: '满足手术要求', value: '是' },
        ],
      },
    ],
  },
  nerveBlock: {
    key: 'nerveBlock',
    title: '神经阻滞模块',
    summary: '阻滞部位、侧别、引导方式、局麻药、阻滞范围和阻滞效果。',
    accent: '#722ed1',
    sections: [
      {
        title: '阻滞操作',
        items: [
          { label: '阻滞类型', value: '臂丛神经阻滞', emphasis: true },
          { label: '侧别', value: '左侧' },
          { label: '引导方式', value: '超声引导' },
        ],
      },
      {
        title: '局麻药使用',
        items: [
          { label: '局麻药', value: '罗哌卡因', emphasis: true },
          { label: '浓度', value: '0.375%' },
          { label: '容量', value: '20ml' },
          { label: '起效时间', value: '10分钟' },
        ],
      },
      {
        title: '阻滞效果',
        items: [
          { label: '感觉阻滞范围', value: '左上肢', emphasis: true },
          { label: '运动阻滞情况', value: '左手握力减弱' },
          { label: '阻滞效果', value: '完全' },
          { label: '并发症', value: '无' },
        ],
      },
    ],
  },
  local: {
    key: 'local',
    title: '局部麻醉模块',
    summary: '局麻部位、局麻药、剂量、麻醉效果和不良反应。',
    accent: '#00b42a',
    sections: [
      {
        title: '局麻记录',
        items: [
          { label: '麻醉部位', value: '切口局部浸润', emphasis: true },
          { label: '局麻药', value: '利多卡因' },
          { label: '浓度', value: '1%' },
          { label: '剂量', value: '10ml' },
          { label: '麻醉效果', value: '满意' },
          { label: '是否追加', value: '否' },
          { label: '不良反应', value: '无' },
        ],
      },
    ],
  },
  sedation: {
    key: 'sedation',
    title: '镇静/监护麻醉模块',
    summary: '镇静方式、镇静程度、氧疗、呼吸状态、镇静药物和不良反应。',
    accent: '#f77234',
    sections: [
      {
        title: '镇静与呼吸',
        items: [
          { label: '镇静方式', value: '静脉镇静', emphasis: true },
          { label: '镇静评分', value: 'Ramsay 3级' },
          { label: '氧疗方式', value: '鼻导管吸氧' },
          { label: '自主呼吸', value: '是' },
          { label: 'SpO2', value: '98%' },
          { label: 'EtCO2', value: '38mmHg' },
        ],
      },
      {
        title: '镇静用药',
        items: [
          { label: '镇静药物', value: '丙泊酚泵注', emphasis: true },
          { label: '不良反应', value: '无' },
        ],
      },
    ],
  },
};

export const quickEventOptions: QuickEventOption[] = [
  { name: '麻醉开始', stage: '入室后', severity: '轻度', syncField: 'anesthesiaStart' },
  { name: '诱导开始', stage: '诱导期', severity: '轻度' },
  { name: '插管', stage: '诱导期', severity: '轻度' },
  { name: '喉罩置入', stage: '诱导期', severity: '轻度' },
  { name: '接麻醉机', stage: '诱导期', severity: '轻度' },
  { name: '单肺通气', stage: '诱导期', severity: '中度' },
  { name: '定位', stage: '诱导期', severity: '轻度' },
  { name: '穿刺', stage: '诱导期', severity: '轻度' },
  { name: '置管', stage: '诱导期', severity: '轻度' },
  { name: '给药', stage: '术中', severity: '轻度' },
  { name: '开始吸入', stage: '术中', severity: '轻度' },
  { name: '开始吸入麻醉', stage: '术中', severity: '轻度' },
  { name: '调整浓度', stage: '术中', severity: '轻度' },
  { name: '调整吸入浓度', stage: '术中', severity: '轻度' },
  { name: '停止吸入', stage: '术中', severity: '轻度' },
  { name: '停止吸入麻醉', stage: '苏醒期', severity: '轻度' },
  { name: '平面测定', stage: '术中', severity: '轻度' },
  { name: '阻滞评估', stage: '术中', severity: '轻度' },
  { name: '镇静开始', stage: '诱导期', severity: '轻度' },
  { name: '局麻', stage: '诱导期', severity: '轻度' },
  { name: '镇静评估', stage: '术中', severity: '轻度' },
  { name: '手术开始', stage: '术中', severity: '轻度', syncField: 'surgeryStart' },
  { name: '气腹建立', stage: '术中', severity: '轻度' },
  { name: '胎儿娩出', stage: '术中', severity: '轻度' },
  { name: '止血带充气', stage: '术中', severity: '轻度' },
  { name: '止血带放气', stage: '术中', severity: '中度' },
  { name: '内镜开始', stage: '术中', severity: '轻度' },
  { name: '内镜结束', stage: '术中', severity: '轻度' },
  { name: '肺复张', stage: '术中', severity: '轻度' },
  { name: '低血压', stage: '术中', severity: '中度', treatment: '快捷事件：低血压，已记录升压/补液处理思路。' },
  { name: '低氧', stage: '术中', severity: '中度' },
  { name: '低体温', stage: '术中', severity: '中度' },
  { name: '升压药', stage: '术中', severity: '轻度' },
  { name: '手术结束', stage: '术中', severity: '轻度', syncField: 'surgeryEnd' },
  { name: '拔管', stage: '苏醒期', severity: '轻度' },
  { name: '拔除喉罩', stage: '苏醒期', severity: '轻度' },
  { name: '麻醉结束', stage: '苏醒期', severity: '轻度', syncField: 'anesthesiaEnd' },
  { name: '苏醒评估', stage: '苏醒期', severity: '轻度' },
  { name: '离室', stage: '苏醒期', severity: '轻度', syncField: 'leaveRoomTime' },
];

export const stageQuickActionsByMethod: Record<AnesthesiaMethodKey, Partial<Record<IntraopStage, string[]>>> = {
  general: {
    入室后: ['麻醉开始', '诱导开始', '给药'],
    诱导期: ['诱导开始', '给药', '插管', '接麻醉机', '手术开始', '开始吸入'],
    术中: ['给药', '低血压', '升压药', '手术开始', '调整浓度'],
    苏醒期: ['拔管', '麻醉结束', '停止吸入', '离室'],
    离室: ['离室'],
  },
  neuraxial: {
    入室后: ['麻醉开始', '穿刺'],
    诱导期: ['穿刺', '给药', '置管', '平面测定', '手术开始'],
    术中: ['平面测定', '给药', '低血压', '升压药'],
    苏醒期: ['麻醉结束', '离室'],
    离室: ['离室'],
  },
  nerveBlock: {
    入室后: ['麻醉开始', '定位'],
    诱导期: ['定位', '穿刺', '给药', '阻滞评估', '手术开始'],
    术中: ['阻滞评估', '给药', '低血压'],
    苏醒期: ['麻醉结束', '离室'],
    离室: ['离室'],
  },
  local: {
    入室后: ['麻醉开始', '局麻'],
    诱导期: ['局麻', '给药', '手术开始'],
    术中: ['给药', '低血压'],
    苏醒期: ['麻醉结束', '离室'],
    离室: ['离室'],
  },
  sedation: {
    入室后: ['麻醉开始', '镇静开始'],
    诱导期: ['镇静开始', '给药', '镇静评估', '手术开始'],
    术中: ['镇静评估', '给药', '低血压'],
    苏醒期: ['麻醉结束', '离室'],
    离室: ['离室'],
  },
};

export const scenarioQuickActionsByStage: Record<SurgeryScenarioKey, Partial<Record<IntraopStage, string[]>>> = {
  generalSurgery: {
    术中: ['手术开始', '给药', '低血压'],
    苏醒期: ['麻醉结束', '离室'],
  },
  laparoscopic: {
    术中: ['气腹建立', '低血压', '低体温', '手术开始'],
    苏醒期: ['拔管', '麻醉结束', '离室'],
  },
  cesarean: {
    诱导期: ['穿刺', '给药', '平面测定', '手术开始'],
    术中: ['胎儿娩出', '低血压', '升压药', '平面测定'],
    苏醒期: ['麻醉结束', '离室'],
  },
  orthopedic: {
    诱导期: ['定位', '穿刺', '给药', '阻滞评估', '手术开始'],
    术中: ['止血带充气', '止血带放气', '低血压', '阻滞评估'],
  },
  thoracic: {
    诱导期: ['插管', '单肺通气', '接麻醉机', '手术开始'],
    术中: ['单肺通气', '低氧', '肺复张', '低血压'],
    苏醒期: ['拔管', '麻醉结束', '离室'],
  },
  ambulatoryMinor: {
    入室后: ['麻醉开始', '镇静开始'],
    诱导期: ['镇静开始', '局麻', '手术开始'],
    术中: ['镇静评估', '给药', '低氧'],
    苏醒期: ['苏醒评估', '麻醉结束', '离室'],
  },
  endoscopy: {
    入室后: ['麻醉开始', '镇静开始'],
    诱导期: ['镇静开始', '内镜开始'],
    术中: ['镇静评估', '低氧', '内镜结束'],
    苏醒期: ['苏醒评估', '麻醉结束', '离室'],
  },
  neurosurgery: {
    诱导期: ['诱导开始', '插管', '接麻醉机', '手术开始'],
    术中: ['低血压', '给药', '低体温'],
    苏醒期: ['麻醉结束', '离室'],
  },
};

export const workflowGuidanceRules: WorkflowGuidanceRule[] = [
  {
    id: 'general-intubated-airway-check',
    kind: 'recommendation',
    level: '关注',
    text: '确认EtCO2波形、气道固定深度和呼吸机参数。',
    methods: ['general'],
    stages: ['诱导期', '术中'],
    requiresAnyEvent: ['插管', '喉罩置入'],
    focusModuleKeys: ['general'],
  },
  {
    id: 'laparoscopic-pneumoperitoneum',
    kind: 'recommendation',
    level: '关注',
    text: '腹腔镜气腹后复核气道压、EtCO2和循环变化。',
    scenarios: ['laparoscopic'],
    stages: ['术中'],
    focusModuleKeys: ['general'],
  },
  {
    id: 'laparoscopic-hypothermia-risk',
    kind: 'risk',
    level: '关注',
    text: '腹腔镜长时间手术需持续关注体温和主动保温记录。',
    scenarios: ['laparoscopic'],
    stages: ['术中'],
  },
  {
    id: 'neuraxial-cesarean-plane',
    kind: 'recommendation',
    level: '关注',
    text: '记录麻醉平面、Bromage评分、血压变化和升压处理。',
    methods: ['neuraxial'],
    scenarios: ['cesarean'],
    stages: ['诱导期', '术中'],
    focusModuleKeys: ['neuraxial'],
  },
  {
    id: 'cesarean-delivery-next',
    kind: 'nextStep',
    level: '提示',
    text: '胎儿娩出后记录时间、宫缩/出血、缩宫素或升压处理。',
    scenarios: ['cesarean'],
    stages: ['术中'],
    excludesAnyEvent: ['胎儿娩出'],
  },
  {
    id: 'nerve-block-effect-check',
    kind: 'recommendation',
    level: '提示',
    text: '阻滞完成后补充感觉阻滞范围、运动阻滞情况和阻滞效果。',
    methods: ['nerveBlock'],
    stages: ['诱导期', '术中'],
    focusModuleKeys: ['nerveBlock'],
  },
  {
    id: 'orthopedic-tourniquet-risk',
    kind: 'risk',
    level: '关注',
    text: '骨科止血带使用时记录充气/放气时间和放气后循环变化。',
    scenarios: ['orthopedic'],
    stages: ['术中'],
  },
  {
    id: 'sedation-respiratory-risk',
    kind: 'risk',
    level: '预警',
    text: '镇静/监护麻醉需密切观察SpO2、RR和呼吸抑制处置。',
    methods: ['sedation'],
    stages: ['诱导期', '术中', '苏醒期'],
    focusModuleKeys: ['sedation'],
  },
  {
    id: 'endoscopy-oxygen-next',
    kind: 'nextStep',
    level: '提示',
    text: '内镜场景下一步关注氧疗方式、体位、呼吸道通畅和苏醒评分。',
    scenarios: ['endoscopy'],
    stages: ['诱导期', '术中', '苏醒期'],
  },
  {
    id: 'thoracic-one-lung-risk',
    kind: 'risk',
    level: '预警',
    text: '胸科单肺通气需记录氧合、气道压、肺复张和双肺通气恢复。',
    scenarios: ['thoracic'],
    stages: ['诱导期', '术中'],
    focusModuleKeys: ['general'],
  },
  {
    id: 'recovery-next',
    kind: 'nextStep',
    level: '提示',
    text: '苏醒期补齐拔管/喉罩拔除、意识、呼吸循环、疼痛评分和离室去向。',
    stages: ['苏醒期'],
  },
  {
    id: 'leave-room-next',
    kind: 'nextStep',
    level: '提示',
    text: '确认离室生命体征、去向、交接人和医生签名。',
    stages: ['离室'],
  },
  {
    id: 'maintenance-next',
    kind: 'nextStep',
    level: '提示',
    text: '维持期继续记录生命体征、用药调整、出入量和关键事件。',
    stages: ['术中'],
  },
];

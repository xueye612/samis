import type { PostoperativeFollowUp, SurgeryCase, VitalSign } from '@/types/anesthesia';
import type { DrugDictItem, FluidBloodDictItem, VitalSignDictItem } from '@/types/system';

export type PrototypeModuleKey =
  | 'patientInfo'
  | 'surgeryInfo'
  | 'preVisit'
  | 'intraopData'
  | 'postVisit'
  | 'summary'
  | 'quality'
  | 'operationPanel';

export interface PrototypeComponentPlan {
  key: PrototypeModuleKey;
  title: string;
  responsibility: string;
  primaryData: string[];
  interactions: string[];
  nextStep: string;
}

export interface WorkflowNode {
  key: string;
  title: string;
  owner: string;
  modules: PrototypeModuleKey[];
  output: string;
}

export interface DataDictionaryField {
  domain: string;
  field: string;
  type: string;
  unit?: string;
  options?: string;
  defaultValue?: string;
  required?: boolean;
  source: string;
}

export interface QualityExtractionField {
  code: string;
  label: string;
  path: string;
  statistic: string;
  rule: string;
  owner: string;
}

export interface VisualGuideline {
  area: string;
  recommendation: string;
  token: string;
}

export interface PrintExportProfile {
  name: string;
  scope: string;
  excludes: string;
  style: string;
}

export interface PrototypeMetrics {
  caseCount: number;
  completedPreVisitCount: number;
  preVisitRate: number;
  followUpCount: number;
  followUpRate: number;
  medicationCount: number;
  highAlertUncheckedCount: number;
  fluidVolumeTotal: number;
  bloodProductCount: number;
  uncheckedBloodProductCount: number;
  qualityEventCount: number;
  abnormalVitalCount: number;
  missingItemCount: number;
}

export interface IntraopSnapshot {
  caseId: string;
  patientName: string;
  room: string;
  surgeryName: string;
  status: SurgeryCase['status'];
  medicationCount: number;
  highAlertUncheckedCount: number;
  fluidVolume: number;
  bloodProductCount: number;
  outputVolume: number;
  abnormalVitalCount: number;
  qualityEventCount: number;
  completionScore: number;
}

export const prototypeComponentPlans: PrototypeComponentPlan[] = [
  {
    key: 'patientInfo',
    title: '患者信息区',
    responsibility: '展示患者身份、科室、诊断、风险标签与当前流程状态，作为所有模块的上下文入口。',
    primaryData: ['patientId', 'patientName', 'gender', 'age', 'department', 'diagnosis', 'asa'],
    interactions: ['患者切换', '风险标签筛选', '进入详情页'],
    nextStep: '抽取 PatientBriefCard 组件，统一用于访视、小结、随访和质控明细。',
  },
  {
    key: 'surgeryInfo',
    title: '手术信息区',
    responsibility: '聚合手术、麻醉方式、术者、计划/实际时间、转归去向与房间信息。',
    primaryData: ['surgeryName', 'anesthesiaMethod', 'surgeon', 'room', 'plannedStart', 'transferTo'],
    interactions: ['时间轴定位', '进入记录单', '查看关键事件'],
    nextStep: '形成 SurgeryContextPanel，支持在侧栏中与各业务单据联动。',
  },
  {
    key: 'preVisit',
    title: '术前访视组件',
    responsibility: '录入病史、过敏史、困难气道、禁食、术前用药、检查审核与麻醉计划。',
    primaryData: ['preVisit.completed', 'height', 'weight', 'asa', 'allergy', 'difficultAirway', 'plan'],
    interactions: ['分组表单', '必填校验', '一键提交', '未完成提醒'],
    nextStep: '复用到 /surgery/pre-visit 与 /surgery/plan，减少重复表单逻辑。',
  },
  {
    key: 'intraopData',
    title: '麻醉中数据展示组件',
    responsibility: '按时间聚合用药、液体、输血、生命体征、出入量和关键事件。',
    primaryData: ['medications', 'fluids', 'vitals', 'events', 'outputs', 'outputRecords'],
    interactions: ['趋势查看', '事件过滤', '异常值处理', '批量录入入口'],
    nextStep: '将列表页升级为 IntraopDataPanel + IntraopTimeline，可嵌入详情页和小结页。',
  },
  {
    key: 'postVisit',
    title: '术后访视组件',
    responsibility: '记录疼痛评分、恢复质量、麻醉相关不良反应、异常事件与处理意见。',
    primaryData: ['followTime', 'vas', 'nausea', 'headache', 'hoarseness', 'reintubation', 'advice'],
    interactions: ['异常勾选', '满意度评分', '打印随访单', '生成待办'],
    nextStep: '将未路由的丰富随访页能力合并到 routed followup 页面。',
  },
  {
    key: 'summary',
    title: '麻醉小结组件',
    responsibility: '汇总用药、液体/输血、关键事件、恢复情况、并发症与麻醉效果评价。',
    primaryData: ['summaryRecords', 'medications', 'fluids', 'events', 'recoveryRecord'],
    interactions: ['自动带入统计', '草稿/提交', '签名状态', '导出摘要'],
    nextStep: '从 SurgeryCase 派生摘要数据，减少手工重复录入。',
  },
  {
    key: 'quality',
    title: '数据统计与质控模块',
    responsibility: '提取可计算字段，形成缺项、异常值、事件上报、访视完成率等指标。',
    primaryData: ['qualityDataset', 'qualityDefects', 'indicatorDetails', 'todos'],
    interactions: ['指标钻取', '缺陷整改', 'CSV 导出', 'PDCA 闭环'],
    nextStep: '把原型字段清单映射到 qualityCalculator 的指标定义。',
  },
  {
    key: 'operationPanel',
    title: '通用操作面板',
    responsibility: '承载快捷操作、右键菜单、批量录入、打印预览和导出入口。',
    primaryData: ['configDrugs', 'configFluids', 'configEvents', 'configPrintTemplates'],
    interactions: ['常用项', '批量录入', '右键维护', '打印预览'],
    nextStep: '形成 ClinicalActionPanel，按页面场景注入操作集。',
  },
];

export const workflowBlueprint: WorkflowNode[] = [
  { key: 'request', title: '术前准备', owner: '麻醉医生', modules: ['patientInfo', 'surgeryInfo', 'preVisit'], output: '访视完成、风险清单、麻醉计划' },
  { key: 'or-in', title: '入室与诱导', owner: '麻醉医生/护士', modules: ['surgeryInfo', 'intraopData', 'operationPanel'], output: '入室时间、诱导用药、初始生命体征' },
  { key: 'intraop', title: '术中管理', owner: '麻醉团队', modules: ['intraopData', 'quality', 'operationPanel'], output: '趋势、用药、液体/输血、事件与异常处置' },
  { key: 'recovery', title: '苏醒与转归', owner: '麻醉医生/PACU', modules: ['summary', 'postVisit', 'quality'], output: '小结、恢复情况、转归和待随访事项' },
  { key: 'followup', title: '术后闭环', owner: '随访护士/质控员', modules: ['postVisit', 'quality'], output: '随访记录、并发症、质控缺陷和改进项' },
];

export const baseDictionaryFields: DataDictionaryField[] = [
  { domain: '药品', field: 'name/code/specification', type: 'string', unit: 'doseUnit', defaultValue: 'defaultDose', required: true, source: 'configDrugs' },
  { domain: '药品', field: 'defaultRoute/defaultMode/highAlert', type: 'enum/boolean', options: '静脉/泵入/吸入等', required: true, source: 'configDrugs' },
  { domain: '液体/血制品', field: 'name/subCategory/defaultVolume', type: 'string/enum/number', unit: 'defaultUnit', options: '晶体液/胶体液/血液制品/自体血回输', required: true, source: 'configFluids' },
  { domain: '液体/血制品', field: 'requiresDoubleCheck', type: 'boolean', defaultValue: '血制品默认 true', source: 'configFluids' },
  { domain: '生命体征', field: 'shortCode/unit/normalRange', type: 'string', options: 'HR/SBP/DBP/SpO2/RR/TEMP 等', required: true, source: 'configVitals' },
  { domain: '生命体征', field: 'lowerLimit/upperLimit/chartEnabled/chartColor', type: 'number/boolean/color', defaultValue: '来自字典', source: 'configVitals' },
  { domain: '事件', field: 'type/stage/severity/qualityIncluded', type: 'enum/boolean', options: '低血压/低氧/抢救/非计划转ICU等', required: true, source: 'configEvents + case.events' },
  { domain: '手术状态', field: 'status/recordStatus/collectStatus', type: 'enum', options: '待入室/麻醉中/PACU/已离室；采集中/已锁定等', required: true, source: 'SurgeryCase' },
  { domain: '术前访视', field: 'height/weight/asa/allergy/difficultAirway/plan/completed', type: 'number/string/boolean', unit: 'cm/kg', required: true, source: 'case.preVisit' },
  { domain: '术后随访', field: 'vas/nausea/headache/hoarseness/reintubation/transferredIcu/death', type: 'number/boolean', unit: 'VAS 0-10', required: true, source: 'followUps' },
];

export const qualityExtractionFields: QualityExtractionField[] = [
  { code: 'QC-PRE-001', label: '择期术前访视完成率', path: 'case.preVisit.completed', statistic: '完成例数 / 择期手术例数', rule: '择期且未完成生成高优先级待办', owner: '术前访视' },
  { code: 'QC-PRE-002', label: 'ASA 与困难气道完整性', path: 'case.preVisit.asa + difficultAirway', statistic: '缺项例数', rule: 'ASA、困难气道为空时计为缺项', owner: '术前访视' },
  { code: 'QC-MED-001', label: '高警示药品核对率', path: 'case.medications[].highAlert/checker', statistic: '已核对高警示用药 / 高警示用药', rule: 'highAlert=true 且 checker 为空计为缺陷', owner: '术中用药' },
  { code: 'QC-FLD-001', label: '血制品双人核对率', path: 'case.fluids[].category/doubleCheck', statistic: '已核对血制品 / 血制品总数', rule: '血液制品 doubleCheck=false 计为缺陷', owner: '输液输血' },
  { code: 'QC-VIT-001', label: '生命体征异常处置率', path: 'case.vitals[].abnormalHandled', statistic: '已处置异常点 / 异常点总数', rule: '超出字典上下限且未处置计为待处理', owner: '术中监测' },
  { code: 'QC-EVT-001', label: '不良事件上报完成率', path: 'case.events[].qualityIncluded/reported', statistic: '已上报质控事件 / 质控事件总数', rule: 'qualityIncluded=true 且 reported=false 计为待审核', owner: '特殊事件' },
  { code: 'QC-SUM-001', label: '麻醉小结提交率', path: 'summaryRecords[].status/doctorSigned', statistic: '已提交且签名 / 需小结病例', rule: '已离室/PACU/苏醒中病例需要小结', owner: '麻醉小结' },
  { code: 'QC-POST-001', label: '术后随访覆盖率', path: 'followUps[].caseId', statistic: '有随访病例 / 术后镇痛或全麻病例', rule: '术后镇痛病例无随访生成待办', owner: '术后随访' },
];

export const visualGuidelines: VisualGuideline[] = [
  { area: '页面基调', recommendation: '以白、灰、医疗蓝为主，浅青绿色用于质控与恢复状态，避免大面积渐变。', token: '--surface / --medical-bg / --primary' },
  { area: '核心区域', recommendation: '患者、手术、当前状态和待处理风险置顶，使用左侧主工作区 + 右侧克制信息面板。', token: '.module-hero / .clinical-prototype-grid' },
  { area: '操作区', recommendation: '主按钮只保留 1 个，次要操作使用默认按钮或更多菜单，危险操作使用红色标签确认。', token: 'type=primary / color=red' },
  { area: '趋势图', recommendation: '折线颜色固定、图例简洁，异常点通过标签或列表解释，不堆叠过多阴影。', token: 'qualityChartPalette' },
  { area: '表格', recommendation: '首列保留患者上下文，数值字段带单位，异常字段用 tag 标注并保留横向滚动。', token: '.compact-table / --text-secondary' },
  { area: '响应式', recommendation: '统计卡片自动换行，主从布局在 1200px 以下变为单列，打印区域隐藏交互控件。', token: '@media max-width: 1200px / @media print' },
];

export const printExportProfiles: PrintExportProfile[] = [
  { name: '术前访视预览', scope: '患者基本信息、风险评估、访视结论、签名', excludes: '麻醉记录单本体', style: 'A4 纵向，表单块边框，隐藏页面导航与操作按钮' },
  { name: '术后随访预览', scope: 'VAS、恢复情况、异常事件、处理意见、满意度', excludes: 'PACU 原始记录曲线', style: 'A4 纵向，异常项置顶，随访结论突出' },
  { name: '麻醉小结导出', scope: '用药总览、液体/输血统计、关键事件、恢复情况', excludes: '麻醉记录单趋势页', style: 'A4 纵向或 PDF 摘要，统计表 + 事件时间轴' },
  { name: '质控数据 CSV', scope: '质控字段、统计口径、病例 ID、缺陷状态', excludes: '患者敏感明细可按权限脱敏', style: 'CSV/Excel，字段名稳定，便于后续 BI 汇总' },
];

const roundRate = (numerator: number, denominator: number) => (denominator ? Math.round((numerator / denominator) * 100) : 0);

const isAbnormalVital = (vital: VitalSign) => {
  const checks: Array<[keyof VitalSign, number | undefined, number | undefined]> = [
    ['HR', 50, 120],
    ['SBP', 90, 160],
    ['DBP', 50, 100],
    ['SpO2', 95, undefined],
    ['RR', 8, 25],
    ['EtCO2', 30, 45],
    ['TEMP', 35.5, 38.5],
  ];
  return checks.some(([key, lower, upper]) => {
    const value = vital[key];
    if (typeof value !== 'number') return false;
    return (lower !== undefined && value < lower) || (upper !== undefined && value > upper);
  });
};

const countAbnormalVitals = (vitals: VitalSign[]) => vitals.filter(isAbnormalVital).length;

export function buildPrototypeMetrics(cases: SurgeryCase[], followUps: PostoperativeFollowUp[]): PrototypeMetrics {
  const electiveCases = cases.filter((item) => item.urgency === '择期');
  const completedPreVisitCount = electiveCases.filter((item) => item.preVisit.completed).length;
  const followUpCaseIds = new Set(followUps.map((item) => item.caseId));
  const followUpTargets = cases.filter((item) => item.postoperativeAnalgesia || ['PACU', '已离室'].includes(item.status));
  const medicationRows = cases.flatMap((item) => item.medications);
  const fluidRows = cases.flatMap((item) => item.fluids);
  const highAlertUncheckedCount = medicationRows.filter((item) => item.highAlert && !item.checker).length;
  const bloodRows = fluidRows.filter((item) => item.category === '血液制品');
  const uncheckedBloodProductCount = bloodRows.filter((item) => !item.doubleCheck).length;
  const qualityEventCount = cases.flatMap((item) => item.events).filter((item) => item.qualityIncluded).length;
  const abnormalVitalCount = cases.reduce((sum, item) => sum + countAbnormalVitals(item.vitals), 0);
  const missingPreVisitCount = electiveCases.length - completedPreVisitCount;
  const missingFollowUpCount = followUpTargets.filter((item) => !followUpCaseIds.has(item.id)).length;

  return {
    caseCount: cases.length,
    completedPreVisitCount,
    preVisitRate: roundRate(completedPreVisitCount, electiveCases.length),
    followUpCount: followUps.length,
    followUpRate: roundRate(followUpTargets.length - missingFollowUpCount, followUpTargets.length),
    medicationCount: medicationRows.length,
    highAlertUncheckedCount,
    fluidVolumeTotal: fluidRows.reduce((sum, item) => sum + (item.category === '血液制品' ? 0 : Number(item.volume) || 0), 0),
    bloodProductCount: bloodRows.length,
    uncheckedBloodProductCount,
    qualityEventCount,
    abnormalVitalCount,
    missingItemCount: missingPreVisitCount + missingFollowUpCount + highAlertUncheckedCount + uncheckedBloodProductCount,
  };
}

export function buildIntraopSnapshots(cases: SurgeryCase[]): IntraopSnapshot[] {
  return cases.map((item) => {
    const highAlertUncheckedCount = item.medications.filter((row) => row.highAlert && !row.checker).length;
    const bloodProductCount = item.fluids.filter((row) => row.category === '血液制品').length;
    const qualityEventCount = item.events.filter((event) => event.qualityIncluded).length;
    const abnormalVitalCount = countAbnormalVitals(item.vitals);
    const completedChecks = [
      item.preVisit.completed,
      item.medications.length > 0,
      item.vitals.length > 0,
      item.fluids.length > 0,
      highAlertUncheckedCount === 0,
      item.events.every((event) => !event.qualityIncluded || event.reported),
    ].filter(Boolean).length;

    return {
      caseId: item.id,
      patientName: item.patientName,
      room: item.room,
      surgeryName: item.surgeryName,
      status: item.status,
      medicationCount: item.medications.length,
      highAlertUncheckedCount,
      fluidVolume: item.fluids.reduce((sum, row) => sum + (row.category === '血液制品' ? 0 : Number(row.volume) || 0), 0),
      bloodProductCount,
      outputVolume: item.outputs.urine + item.outputs.bloodLoss + item.outputs.drainage,
      abnormalVitalCount,
      qualityEventCount,
      completionScore: roundRate(completedChecks, 6),
    };
  });
}

export function buildDictionarySummary(
  drugs: DrugDictItem[],
  fluids: FluidBloodDictItem[],
  vitals: VitalSignDictItem[],
  events: string[],
) {
  return [
    { name: '药品字典', count: drugs.length, enabled: drugs.filter((item) => item.enabled).length, remark: '含规格、单位、默认剂量、给药途径和高警示标记' },
    { name: '液体/血制品字典', count: fluids.length, enabled: fluids.filter((item) => item.enabled).length, remark: '含默认容量、单位、分类和双人核对要求' },
    { name: '生命体征字典', count: vitals.length, enabled: vitals.filter((item) => item.enabled).length, remark: '含单位、上下限、默认值和图表展示规则' },
    { name: '事件字典', count: events.length, enabled: events.length, remark: '用于关键事件、抢救记录和质控事件归类' },
  ];
}

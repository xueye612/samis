import dayjs from 'dayjs';
import {
  anesthesiaMethodOptions,
  anesthesiaTemplateOptions,
  dynamicAnesthesiaModuleEntries,
  intraopStageOptions,
  quickEventOptions,
  scenarioQuickActionsByStage,
  surgeryScenarioOptions,
  stageQuickActionsByMethod,
  templateImpactMap,
  workflowGuidanceRules,
  type AnesthesiaMethodKey,
  type AnesthesiaTemplateOption,
  type CompletionGap,
  type DynamicModuleEntry,
  type IntraopStage,
  type TemplateLandingItem,
  type TemplateImpact,
  type QuickEventOption,
  type SurgeryScenarioKey,
  type SurgeryScenarioOption,
  type TemplateQualityTip,
  type WorkflowGuidanceKind,
} from '@/mock/anesthesiaRecordPrototype';
import type { AnesthesiaEvent, SurgeryCase } from '@/types/anesthesia';

export type { AnesthesiaMethodKey, AnesthesiaTemplateOption, CompletionGap, DynamicModuleEntry, IntraopStage, QuickEventOption, SurgeryScenarioKey, SurgeryScenarioOption, TemplateImpact, TemplateLandingItem };

export interface AnesthesiaMethodSelection {
  primary: AnesthesiaMethodKey;
  auxiliary: AnesthesiaMethodKey[];
  templateName?: string;
}

export interface AnesthesiaTemplateApplyDraft extends AnesthesiaMethodSelection {
  templateName: string;
  methodKeys: AnesthesiaMethodKey[];
  methodLabels: string[];
  modules: DynamicModuleEntry[];
  showAnesthesiaPlane: boolean;
  impact: TemplateImpact;
}

export interface TemplateLandingDraft extends AnesthesiaTemplateApplyDraft {
  items: TemplateLandingItem[];
}

export interface WorkflowGuidanceItem {
  id: string;
  kind: WorkflowGuidanceKind | 'pending';
  level: '提示' | '关注' | '预警';
  text: string;
  relatedEventName?: string;
  focusModuleKeys?: AnesthesiaMethodKey[];
}

export interface ScenarioWorkflowContext {
  stageOptions: IntraopStage[];
  scenarioOptions: SurgeryScenarioOption[];
  quickEvents: QuickEventOption[];
  recommendedItems: WorkflowGuidanceItem[];
  pendingItems: WorkflowGuidanceItem[];
  risks: WorkflowGuidanceItem[];
  nextSteps: WorkflowGuidanceItem[];
  focusModuleKeys: AnesthesiaMethodKey[];
  qualityTips: TemplateQualityTip[];
}

export interface ScenarioWorkflowInput {
  item: SurgeryCase;
  methods: AnesthesiaMethodKey[];
  scenario: SurgeryScenarioKey;
  stage: IntraopStage;
  selectedTemplateName?: string;
  confirmedImpact?: TemplateImpact;
}

export const ANESTHESIA_METHOD_KEYS = anesthesiaMethodOptions.map((item) => item.key);
export const INTRAOP_STAGE_OPTIONS = intraopStageOptions;
export const SURGERY_SCENARIO_OPTIONS = surgeryScenarioOptions;

export function mergeSelectedMethods(primary: AnesthesiaMethodKey, auxiliary: AnesthesiaMethodKey[] = []): AnesthesiaMethodKey[] {
  return Array.from(new Set([primary, ...auxiliary].filter(Boolean))) as AnesthesiaMethodKey[];
}

export function getDynamicModuleEntries(methods: AnesthesiaMethodKey[]): DynamicModuleEntry[] {
  return methods.map((key) => dynamicAnesthesiaModuleEntries[key]).filter(Boolean);
}

export function getMethodLabels(methods: AnesthesiaMethodKey[]): string[] {
  return methods
    .map((key) => anesthesiaMethodOptions.find((item) => item.key === key)?.label)
    .filter((label): label is string => Boolean(label));
}

export function formatAnesthesiaMethodLabel(methods: AnesthesiaMethodKey[]): string {
  return getMethodLabels(methods).join(' + ');
}

export function hasAnesthesiaPlaneModule(methods: AnesthesiaMethodKey[]): boolean {
  return methods.includes('neuraxial');
}

export function applyAnesthesiaTemplate(templateName: string): AnesthesiaMethodSelection {
  const template = anesthesiaTemplateOptions.find((item) => item.name === templateName);
  if (!template) return { primary: 'general', auxiliary: [], templateName: '' };
  return {
    primary: template.primary,
    auxiliary: [...template.auxiliary],
    templateName: template.name,
  };
}

export function buildTemplateApplyDraft(templateName: string): AnesthesiaTemplateApplyDraft {
  const selection = applyAnesthesiaTemplate(templateName);
  const methodKeys = mergeSelectedMethods(selection.primary, selection.auxiliary);
  const impact = templateImpactMap[selection.templateName ?? ''] ?? emptyTemplateImpact();
  return {
    primary: selection.primary,
    auxiliary: selection.auxiliary,
    templateName: selection.templateName ?? '',
    methodKeys,
    methodLabels: getMethodLabels(methodKeys),
    modules: getDynamicModuleEntries(methodKeys),
    showAnesthesiaPlane: hasAnesthesiaPlaneModule(methodKeys),
    impact,
  };
}

export function buildTemplateLandingDraft(templateName: string): TemplateLandingDraft {
  const draft = buildTemplateApplyDraft(templateName);
  const items: TemplateLandingItem[] = [
    ...draft.impact.events.map((event, index) => ({
      landingId: `${draft.templateName}-event-${index}-${event.name}`,
      kind: 'event' as const,
      status: 'pending' as const,
      sourceTemplate: draft.templateName,
      label: event.name,
      value: `${event.time} ${event.note}`,
      relatedEventName: event.name,
      event,
    })),
    ...draft.impact.medications.map((medication, index) => ({
      landingId: `${draft.templateName}-medication-${index}-${medication.drug}`,
      kind: 'medication' as const,
      status: 'pending' as const,
      sourceTemplate: draft.templateName,
      label: medication.drug,
      value: medication.mode === '持续泵入'
        ? `${medication.time}-${medication.endTime ?? ''} ${medication.pumpRate ?? ''}`
        : `${medication.time} ${medication.dose ?? ''}${medication.unit ?? ''}`,
      relatedEventName: medication.route?.includes('局') ? '给药' : undefined,
      medication,
    })),
    ...draft.impact.monitorCodes.map((monitorCode, index) => ({
      landingId: `${draft.templateName}-monitor-${index}-${monitorCode}`,
      kind: 'monitor' as const,
      status: 'pending' as const,
      sourceTemplate: draft.templateName,
      label: monitorCode,
      value: '推荐监测项',
      monitorCode,
    })),
    ...draft.impact.professionalFields.map((field, index) => ({
      landingId: `${draft.templateName}-field-${index}-${field.label}`,
      kind: 'field' as const,
      status: 'pending' as const,
      sourceTemplate: draft.templateName,
      label: field.label,
      value: field.value,
      relatedEventName: relatedEventNameForField(field.label, field.method),
      field,
    })),
  ];
  return { ...draft, items };
}

export function buildConfirmedTemplateImpact(items: TemplateLandingItem[]): TemplateImpact {
  const selected = items.map((item) => ({ ...item, status: 'confirmed' as const }));
  return {
    events: selected.flatMap((item) => item.kind === 'event' && item.event ? [item.event] : []),
    medications: selected.flatMap((item) => item.kind === 'medication' && item.medication ? [item.medication] : []),
    monitorCodes: Array.from(new Set(selected.flatMap((item) => item.kind === 'monitor' && item.monitorCode ? [item.monitorCode] : []))),
    professionalFields: selected.flatMap((item) => item.kind === 'field' && item.field ? [item.field] : []),
    qualityTips: [],
  };
}

export function filterTemplateImpactForMethods(impact: TemplateImpact | undefined, methods: AnesthesiaMethodKey[]): TemplateImpact | undefined {
  if (!impact) return undefined;
  const selected = new Set(methods);
  return {
    events: impact.events,
    medications: impact.medications.filter((item) => medicationMatchesSelectedMethods(item, selected)),
    monitorCodes: impact.monitorCodes,
    professionalFields: impact.professionalFields.filter((field) => selected.has(field.method)),
    qualityTips: impact.qualityTips,
  };
}

function emptyTemplateImpact(): TemplateImpact {
  return {
    events: [],
    medications: [],
    monitorCodes: [],
    professionalFields: [],
    qualityTips: [],
  };
}

export function deriveMethodSelectionFromCase(item?: Pick<SurgeryCase, 'anesthesiaMethod'>): AnesthesiaMethodSelection {
  const text = item?.anesthesiaMethod ?? '';
  const primary = inferPrimaryMethod(text);
  const auxiliary = ANESTHESIA_METHOD_KEYS.filter((key) => key !== primary && methodTextMatches(text, key));
  return { primary, auxiliary };
}

export function getQuickEventOption(name: string): QuickEventOption {
  return quickEventOptions.find((item) => item.name === name) ?? {
    name,
    stage: '术中',
    severity: '轻度',
  };
}

const TOP_TOOLBAR_QUICK_EVENT_ORDER = ['给药', '低血压', '升压药', '手术开始', '麻醉开始', '手术结束', '麻醉结束', '离室'] as const;
const VOIDED_EVENT_STATUSES = new Set(['voided', '作废', '已作废']);

/** 带 syncField 的里程碑事件是否已记录（可重复事件如给药、低血压始终返回 false） */
export function isQuickEventDone(
  item: Pick<SurgeryCase, 'events' | 'roomInTime' | 'anesthesiaStart' | 'surgeryStart' | 'surgeryEnd' | 'anesthesiaEnd' | 'leaveRoomTime'>,
  option: Pick<QuickEventOption, 'name' | 'syncField'>,
): boolean {
  if (!option.syncField) return false;
  if (item[option.syncField]) return true;
  return item.events
    .filter((event) => !VOIDED_EVENT_STATUSES.has(event.status ?? ''))
    .some((event) => event.type === option.name);
}

export interface TopToolbarQuickEventButton {
  name: string;
  disabled: boolean;
  title?: string;
}

/** 顶栏快捷事件：固定优先级、去重，里程碑已记录则置灰 */
export function resolveTopToolbarQuickEvents(
  item: Pick<SurgeryCase, 'events' | 'anesthesiaStart' | 'surgeryStart' | 'surgeryEnd' | 'anesthesiaEnd' | 'leaveRoomTime'>,
  stage: IntraopStage,
  methods: AnesthesiaMethodKey[],
  selectedTemplate = '',
  scenario?: SurgeryScenarioKey,
): TopToolbarQuickEventButton[] {
  const pool = getStageQuickEvents(stage, methods, selectedTemplate, scenario);
  const seen = new Set<string>();
  const ordered: QuickEventOption[] = [];
  const push = (name: string) => {
    if (seen.has(name)) return;
    const option = pool.find((event) => event.name === name) ?? quickEventOptions.find((event) => event.name === name);
    if (!option) return;
    seen.add(name);
    ordered.push(option);
  };
  TOP_TOOLBAR_QUICK_EVENT_ORDER.forEach((name) => push(name));
  pool.forEach((event) => push(event.name));
  return ordered.slice(0, 4).map((option) => {
    const disabled = isQuickEventDone(item, option);
    return {
      name: option.name,
      disabled,
      title: disabled ? '已记录，不可重复' : undefined,
    };
  });
}

export function deriveCurrentStage(item: Pick<SurgeryCase, 'events' | 'anesthesiaStart' | 'surgeryStart' | 'surgeryEnd' | 'leaveRoomTime'>): IntraopStage {
  const eventTypes = item.events.map((event) => event.type);
  if (item.leaveRoomTime || eventTypes.some((type) => type.includes('离室'))) return '离室';
  if (eventTypes.some((type) => ['拔管', '拔除喉罩', '麻醉结束'].some((key) => type.includes(key)))) return '苏醒期';
  if (item.surgeryStart || eventTypes.some((type) => type.includes('手术开始'))) return '术中';
  if (item.anesthesiaStart || eventTypes.some((type) => ['诱导开始', '穿刺', '定位', '镇静开始'].some((key) => type.includes(key)))) return '诱导期';
  return '入室后';
}

export function inferSurgeryScenarioFromCase(item: Pick<SurgeryCase, 'surgeryName' | 'department' | 'locationType'>): SurgeryScenarioKey {
  const text = `${item.surgeryName ?? ''} ${item.department ?? ''} ${item.locationType ?? ''}`.toLowerCase();
  if (['腹腔镜', '腔镜', 'laparoscopic'].some((word) => text.includes(word))) return 'laparoscopic';
  if (['剖宫产', '产科', 'cesarean'].some((word) => text.includes(word))) return 'cesarean';
  if (['髋', '膝', '骨', '关节', '骨科', '止血带'].some((word) => text.includes(word))) return 'orthopedic';
  if (['胸', '肺', '纵隔', '单肺'].some((word) => text.includes(word))) return 'thoracic';
  if (['内镜', '胃肠镜', '肠镜', '胃镜'].some((word) => text.includes(word)) || item.locationType === '手术室外') return 'endoscopy';
  if (['日间', '门诊', '短小'].some((word) => text.includes(word))) return 'ambulatoryMinor';
  if (['颅', '脑', '神经外', '占位'].some((word) => text.includes(word))) return 'neurosurgery';
  return 'generalSurgery';
}

export function getStageQuickEvents(stage: IntraopStage, methods: AnesthesiaMethodKey[], selectedTemplate = '', scenario?: SurgeryScenarioKey): QuickEventOption[] {
  const templateEvents = selectedTemplate ? (templateImpactMap[selectedTemplate]?.events.map((event) => event.name) ?? []) : [];
  const stageEvents = methods.flatMap((method) => stageQuickActionsByMethod[method][stage] ?? []);
  const scenarioEvents = scenario ? (scenarioQuickActionsByStage[scenario][stage] ?? []) : [];
  const fallback = ['麻醉开始', '给药', '手术开始', '低血压', '麻醉结束', '离室'];
  const names = Array.from(new Set([...stageEvents, ...scenarioEvents, ...templateEvents, ...fallback]));
  return names
    .map((name) => quickEventOptions.find((event) => event.name === name))
    .filter((event): event is QuickEventOption => Boolean(event));
}

export function buildScenarioWorkflowContext(input: ScenarioWorkflowInput): ScenarioWorkflowContext {
  const baseQuickEvents = getStageQuickEvents(input.stage, input.methods, input.selectedTemplateName ?? '', input.scenario);
  const gaps = buildCompletionGaps(input.item, input.methods, input.confirmedImpact).map<WorkflowGuidanceItem>((gap) => ({
    id: gap.id,
    kind: 'pending',
    level: gap.level,
    text: gap.text,
    relatedEventName: gap.relatedEventName,
  }));
  const guidance = [
    ...buildScenarioMethodMismatchGuidance(input),
    ...workflowGuidanceRules.filter((rule) => ruleMatchesWorkflow(rule, input)),
  ]
    .sort((a, b) => workflowRuleScore(b, input) - workflowRuleScore(a, input))
    .map<WorkflowGuidanceItem>((rule) => ({
      id: rule.id,
      kind: rule.kind,
      level: rule.level,
      text: rule.text,
      focusModuleKeys: rule.focusModuleKeys,
    }));

  const focusModuleKeys = Array.from(new Set([
    ...input.methods.filter((method) => method === 'general' && ['诱导期', '术中', '苏醒期'].includes(input.stage)),
    ...input.methods.filter((method) => method === 'neuraxial' && ['诱导期', '术中'].includes(input.stage)),
    ...input.methods.filter((method) => method === 'nerveBlock' && ['诱导期', '术中'].includes(input.stage)),
    ...input.methods.filter((method) => ['sedation', 'local'].includes(method) && ['入室后', '诱导期', '术中', '苏醒期'].includes(input.stage)),
    ...guidance.flatMap((item) => item.focusModuleKeys ?? []),
  ])) as AnesthesiaMethodKey[];

  const qualityTips = [
    ...(input.confirmedImpact?.qualityTips ?? []),
    ...guidance
      .filter((item) => item.kind === 'risk')
      .map((item) => ({ level: item.level, text: item.text } satisfies TemplateQualityTip)),
  ];

  return {
    stageOptions: INTRAOP_STAGE_OPTIONS,
    scenarioOptions: SURGERY_SCENARIO_OPTIONS,
    quickEvents: baseQuickEvents.slice(0, 6),
    recommendedItems: guidance.filter((item) => item.kind === 'recommendation').slice(0, 2),
    pendingItems: prioritizeGaps(gaps, input.item.events).slice(0, 3),
    risks: guidance.filter((item) => item.kind === 'risk').slice(0, 2),
    nextSteps: guidance.filter((item) => item.kind === 'nextStep').slice(0, 1),
    focusModuleKeys,
    qualityTips,
  };
}

function buildScenarioMethodMismatchGuidance(input: ScenarioWorkflowInput): Array<(typeof workflowGuidanceRules)[number]> {
  const requiresGeneralReview = ['neurosurgery', 'thoracic'].includes(input.scenario) && !input.methods.includes('general');
  if (!requiresGeneralReview) return [];
  return [{
    id: 'scenario-method-review',
    kind: 'risk',
    level: '关注',
    text: '当前手术场景与麻醉方式需复核：请确认是否需要全麻、气道或呼吸管理记录。',
    scenarios: [input.scenario],
    stages: [input.stage],
  }];
}

function ruleMatchesWorkflow(rule: (typeof workflowGuidanceRules)[number], input: ScenarioWorkflowInput) {
  const eventNames = input.item.events.map((event) => event.type);
  const includesAny = (values: string[] | undefined, candidates: string[]) => !values?.length || values.some((value) => candidates.includes(value));
  const eventIncludesAny = (values: string[] | undefined) => !values?.length || values.some((value) => eventNames.some((name) => name.includes(value)));
  const eventExcludesAny = (values: string[] | undefined) => !values?.length || values.every((value) => !eventNames.some((name) => name.includes(value)));

  return includesAny(rule.stages, [input.stage]) &&
    includesAny(rule.methods, input.methods) &&
    includesAny(rule.scenarios, [input.scenario]) &&
    eventIncludesAny(rule.requiresAnyEvent) &&
    eventExcludesAny(rule.excludesAnyEvent);
}

function medicationMatchesSelectedMethods(item: TemplateImpact['medications'][number], methods: Set<AnesthesiaMethodKey>) {
  if (methods.has('general')) return true;
  const route = item.route ?? '';
  if (route.includes('椎管')) return methods.has('neuraxial');
  if (route.includes('神经阻滞')) return methods.has('nerveBlock');
  if (route.includes('局部') || route.includes('浸润')) return methods.has('local');
  if (methods.has('sedation') && ['丙泊酚', '芬太尼', '瑞芬太尼'].includes(item.drug)) return true;
  if (['丙泊酚', '芬太尼', '罗库溴铵', '瑞芬太尼'].includes(item.drug)) return false;
  return true;
}

function workflowRuleScore(rule: (typeof workflowGuidanceRules)[number], input: ScenarioWorkflowInput) {
  let score = 0;
  if (rule.stages?.includes(input.stage)) score += 4;
  if (rule.methods?.some((method) => input.methods.includes(method))) score += 3;
  if (rule.scenarios?.includes(input.scenario)) score += 2;
  if (rule.requiresAnyEvent?.length) score += 2;
  if (!rule.methods?.length && !rule.scenarios?.length) score -= 1;
  return score;
}

function prioritizeGaps(items: WorkflowGuidanceItem[], events: Pick<AnesthesiaEvent, 'type'>[]) {
  const recentTypes = events.slice(-3).map((event) => event.type);
  const levelScore = { 预警: 3, 关注: 2, 提示: 1 };
  return [...items].sort((a, b) => {
    const aRelated = a.relatedEventName;
    const bRelated = b.relatedEventName;
    const aRecent = aRelated && recentTypes.some((name) => name.includes(aRelated)) ? 10 : 0;
    const bRecent = bRelated && recentTypes.some((name) => name.includes(bRelated)) ? 10 : 0;
    return (bRecent + levelScore[b.level]) - (aRecent + levelScore[a.level]);
  });
}

export function buildCompletionGaps(
  item: Pick<SurgeryCase, 'events' | 'anesthesiaPlanes'>,
  methods: AnesthesiaMethodKey[],
  confirmedImpact: TemplateImpact | undefined,
): CompletionGap[] {
  const eventNames = item.events.map((event) => event.type);
  const confirmedLabels = new Set(confirmedImpact?.professionalFields.map((field) => field.label) ?? []);
  const monitorCodes = new Set(confirmedImpact?.monitorCodes ?? []);
  const gaps: CompletionGap[] = [];

  if (methods.includes('general')) {
    if (eventNames.some((name) => name.includes('插管')) && (!monitorCodes.has('EtCO2') || !confirmedLabels.has('导管型号') || !confirmedLabels.has('呼吸机模式'))) {
      gaps.push({ id: 'general-intubation-detail', level: '关注', text: '已记录插管，请补充导管型号、插管深度、EtCO2确认和呼吸机参数。', relatedEventName: '插管' });
    }
    gaps.push({ id: 'general-monitoring', level: '提示', text: '全麻病例建议持续关注体温、BIS、TOF记录。' });
  }

  if (methods.includes('neuraxial')) {
    const hasDose = eventNames.some((name) => name.includes('给药'));
    const hasPlaneEvent = eventNames.some((name) => name.includes('平面测定'));
    const hasPlane = confirmedLabels.has('麻醉平面') || Boolean(item.anesthesiaPlanes?.length);
    if (hasPlaneEvent && !hasPlane) {
      gaps.push({ id: 'neuraxial-plane-detail', level: '关注', text: '已记录平面测定，请补充左右侧平面、最高阻滞平面和Bromage评分。', relatedEventName: '平面测定' });
    } else if (hasDose && !hasPlane) {
      gaps.push({ id: 'neuraxial-plane', level: '预警', text: '椎管内给药后，请记录麻醉平面和Bromage评分。', relatedEventName: '平面测定' });
    }
  }

  if (methods.includes('nerveBlock') && (!confirmedLabels.has('感觉阻滞范围') || !confirmedLabels.has('阻滞效果'))) {
    gaps.push({ id: 'nerve-block-effect', level: '关注', text: '神经阻滞请补充感觉阻滞范围和阻滞效果。', relatedEventName: '阻滞评估' });
  }

  if ((methods.includes('sedation') || methods.includes('local')) && !confirmedLabels.has('镇静评分') && !confirmedLabels.has('麻醉效果')) {
    gaps.push({ id: 'sedation-local-effect', level: '提示', text: '镇静/局麻请补充镇静评分、氧疗方式、局麻药和呼吸情况。', relatedEventName: '镇静评估' });
  }

  return gaps;
}

export function buildQuickEventPayload(
  eventName: string,
  item: Pick<SurgeryCase, 'anesthesiologist' | 'anesthesiaNurse'>,
  now = dayjs().toISOString(),
): AnesthesiaEvent {
  const option = getQuickEventOption(eventName);
  const operator = item.anesthesiologist || '模拟医生';
  return {
    id: `quick-${Date.now()}`,
    type: option.name,
    time: now,
    stage: option.stage,
    severity: option.severity,
    treatment: `快捷事件：${option.name}，已由${operator}模拟记录。`,
    staff: [item.anesthesiologist, item.anesthesiaNurse].filter(Boolean),
    reported: false,
    qualityIncluded: ['低血压', '高血压', '低氧', '低体温', '困难气道', '抢救'].includes(option.name),
  };
}

function inferPrimaryMethod(text: string): AnesthesiaMethodKey {
  if (methodTextMatches(text, 'general')) return 'general';
  if (methodTextMatches(text, 'neuraxial')) return 'neuraxial';
  if (methodTextMatches(text, 'nerveBlock')) return 'nerveBlock';
  if (methodTextMatches(text, 'sedation')) return 'sedation';
  if (methodTextMatches(text, 'local')) return 'local';
  return 'general';
}

function methodTextMatches(text: string, key: AnesthesiaMethodKey): boolean {
  const value = text.toLowerCase();
  const matchers: Record<AnesthesiaMethodKey, string[]> = {
    general: ['全身', '全麻', '气管插管', '喉罩', '静吸复合', '全凭静脉'],
    neuraxial: ['椎管', '腰麻', '硬膜外', '腰硬'],
    nerveBlock: ['神经阻滞', '臂丛', '区域阻滞'],
    local: ['局部', '局麻', '浸润'],
    sedation: ['镇静', '监护麻醉', 'mac'],
  };
  return matchers[key].some((word) => value.includes(word.toLowerCase()));
}

function relatedEventNameForField(label: string, method: AnesthesiaMethodKey): string {
  if (method === 'general') {
    if (['气道方式', '导管型号', '呼吸机模式', 'EtCO2'].includes(label)) return '插管';
    if (['拔管/苏醒'].includes(label)) return '拔管';
  }
  if (method === 'neuraxial') {
    if (['穿刺间隙', '脑脊液', '置管'].includes(label)) return '穿刺';
    if (['麻醉平面', 'Bromage评分'].includes(label)) return '平面测定';
  }
  if (method === 'nerveBlock') return label.includes('效果') || label.includes('范围') ? '阻滞评估' : '定位';
  if (method === 'sedation') return '镇静评估';
  if (method === 'local') return '局麻';
  return '给药';
}

import dayjs from 'dayjs';
import {
  anesthesiaMethodOptions,
  anesthesiaTemplateOptions,
  dynamicAnesthesiaModuleEntries,
  quickEventOptions,
  stageQuickActionsByMethod,
  templateImpactMap,
  type AnesthesiaMethodKey,
  type AnesthesiaTemplateOption,
  type CompletionGap,
  type DynamicModuleEntry,
  type IntraopStage,
  type TemplateLandingItem,
  type TemplateImpact,
  type QuickEventOption,
} from '@/mock/anesthesiaRecordPrototype';
import type { AnesthesiaEvent, SurgeryCase } from '@/types/anesthesia';

export type { AnesthesiaMethodKey, AnesthesiaTemplateOption, CompletionGap, DynamicModuleEntry, IntraopStage, QuickEventOption, TemplateImpact, TemplateLandingItem };

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

export const ANESTHESIA_METHOD_KEYS = anesthesiaMethodOptions.map((item) => item.key);

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

export function deriveCurrentStage(item: Pick<SurgeryCase, 'events' | 'anesthesiaStart' | 'surgeryStart' | 'surgeryEnd' | 'leaveRoomTime'>): IntraopStage {
  const eventTypes = item.events.map((event) => event.type);
  if (item.leaveRoomTime || eventTypes.some((type) => type.includes('离室'))) return '离室';
  if (eventTypes.some((type) => ['拔管', '拔除喉罩', '麻醉结束'].some((key) => type.includes(key)))) return '苏醒期';
  if (item.surgeryStart || eventTypes.some((type) => type.includes('手术开始'))) return '术中';
  if (item.anesthesiaStart || eventTypes.some((type) => ['诱导开始', '穿刺', '定位', '镇静开始'].some((key) => type.includes(key)))) return '诱导期';
  return '入室后';
}

export function getStageQuickEvents(stage: IntraopStage, methods: AnesthesiaMethodKey[], selectedTemplate = ''): QuickEventOption[] {
  const templateEvents = selectedTemplate ? (templateImpactMap[selectedTemplate]?.events.map((event) => event.name) ?? []) : [];
  const stageEvents = methods.flatMap((method) => stageQuickActionsByMethod[method][stage] ?? []);
  const fallback = ['麻醉开始', '给药', '手术开始', '低血压', '麻醉结束', '离室'];
  const names = Array.from(new Set([...stageEvents, ...templateEvents, ...fallback]));
  return names
    .map((name) => quickEventOptions.find((event) => event.name === name))
    .filter((event): event is QuickEventOption => Boolean(event));
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
    if (eventNames.some((name) => name.includes('插管')) && (!monitorCodes.has('EtCO2') || !confirmedLabels.has('气道方式'))) {
      gaps.push({ id: 'general-intubation-detail', level: '关注', text: '已记录插管，请补充EtCO2确认、气道/导管信息和拔管/苏醒记录。', relatedEventName: '插管' });
    }
    gaps.push({ id: 'general-monitoring', level: '提示', text: '全麻病例建议持续关注体温、BIS、TOF记录。' });
  }

  if (methods.includes('neuraxial')) {
    const hasDose = eventNames.some((name) => name.includes('给药'));
    const hasPlane = confirmedLabels.has('麻醉平面') || Boolean(item.anesthesiaPlanes?.length);
    if (hasDose && !hasPlane) {
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

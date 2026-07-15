import dayjs from 'dayjs';
import type { StructuredRecordEntityType } from '@/services/anesthesia/structuredRecordRepository';

export type StructuredRecordDraft = Record<string, string | number | null | undefined>;

export interface StructuredRecordFieldDefinition {
  key: string;
  label: string;
  kind?: 'text' | 'number' | 'datetime' | 'select' | 'textarea';
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface StructuredRecordDefinition {
  entityType: StructuredRecordEntityType;
  label: string;
  timeKey: string;
  summaryKeys: string[];
  fields: StructuredRecordFieldDefinition[];
}

const option = (...values: string[]) => values.map((value) => ({ label: value, value }));

export const STRUCTURED_RECORD_DEFINITIONS: StructuredRecordDefinition[] = [
  {
    entityType: 'airway_record', label: '气道操作', timeKey: 'occurredAt', summaryKeys: ['action', 'deviceName', 'result'],
    fields: [
      { key: 'airwayType', label: '气道类型', required: true },
      { key: 'action', label: '操作', kind: 'select', required: true, options: option('intubation', 'extubation', 'replacement', 'other') },
      { key: 'deviceName', label: '器械名称', required: true },
      { key: 'deviceCode', label: '器械编码' },
      { key: 'deviceSize', label: '器械型号' },
      { key: 'attemptNo', label: '尝试次数', kind: 'number' },
      { key: 'airwayGrade', label: '气道分级' },
      { key: 'result', label: '结果', kind: 'select', required: true, options: option('success', 'failed', 'difficult') },
      { key: 'difficultyReason', label: '困难原因', kind: 'textarea' },
      { key: 'extubationCondition', label: '拔管情况', kind: 'textarea' },
      { key: 'operatorId', label: '操作人编码' },
      { key: 'operatorName', label: '操作人姓名' },
      { key: 'occurredAt', label: '发生时间', kind: 'datetime', required: true },
    ],
  },
  {
    entityType: 'ventilation_segment', label: '通气参数', timeKey: 'effectiveAt', summaryKeys: ['mode', 'tidalVolumeMl', 'fio2Percent'],
    fields: [
      { key: 'mode', label: '通气模式', required: true },
      { key: 'tidalVolumeMl', label: '潮气量(ml)', kind: 'number' },
      { key: 'ratePerMin', label: '呼吸频率', kind: 'number' },
      { key: 'peepCmh2o', label: 'PEEP(cmH₂O)', kind: 'number' },
      { key: 'fio2Percent', label: 'FiO₂(%)', kind: 'number' },
      { key: 'peakPressureCmh2o', label: '峰压(cmH₂O)', kind: 'number' },
      { key: 'etco2Mmhg', label: 'EtCO₂(mmHg)', kind: 'number' },
      { key: 'effectiveAt', label: '生效时间', kind: 'datetime', required: true },
      { key: 'endedAt', label: '结束时间', kind: 'datetime' },
      { key: 'operatorId', label: '操作人编码' },
    ],
  },
  {
    entityType: 'infusion_segment', label: '持续输注', timeKey: 'occurredAt', summaryKeys: ['drugName', 'action', 'rateValue'],
    fields: [
      { key: 'medicationLocalId', label: '关联用药本地ID' },
      { key: 'drugCode', label: '药品编码' },
      { key: 'drugName', label: '药品名称', required: true },
      { key: 'concentrationValue', label: '浓度', kind: 'number' },
      { key: 'concentrationUnit', label: '浓度单位', kind: 'select', options: option('mg/ml', 'μg/ml') },
      { key: 'rateValue', label: '速度', kind: 'number' },
      { key: 'rateUnit', label: '速度单位', kind: 'select', options: option('ml/h', 'mg/h', 'μg/kg/min') },
      { key: 'action', label: '动作', kind: 'select', required: true, options: option('start', 'adjust', 'pause', 'stop') },
      { key: 'occurredAt', label: '发生时间', kind: 'datetime', required: true },
      { key: 'operatorId', label: '操作人编码' },
    ],
  },
  {
    entityType: 'transfusion_verification', label: '输血核对', timeKey: 'occurredAt', summaryKeys: ['bloodBagNo', 'productName', 'verificationStatus'],
    fields: [
      { key: 'verificationStatus', label: '核对状态', kind: 'select', required: true, options: option('verified', 'started', 'completed', 'reaction') },
      { key: 'bloodBagNo', label: '血袋号', required: true },
      { key: 'productCode', label: '制品编码' },
      { key: 'productName', label: '制品名称', required: true },
      { key: 'aboType', label: 'ABO血型' },
      { key: 'rhType', label: 'Rh血型' },
      { key: 'volume', label: '容量', kind: 'number' },
      { key: 'volumeUnit', label: '容量单位', kind: 'select', options: option('ml', 'unit') },
      { key: 'verifierOneId', label: '第一核对人编码', required: true },
      { key: 'verifierTwoId', label: '第二核对人编码', required: true },
      { key: 'startedAt', label: '开始时间', kind: 'datetime' },
      { key: 'endedAt', label: '结束时间', kind: 'datetime' },
      { key: 'reactionDescription', label: '反应描述', kind: 'textarea' },
      { key: 'treatment', label: '处理', kind: 'textarea' },
      { key: 'occurredAt', label: '核对时间', kind: 'datetime', required: true },
    ],
  },
  {
    entityType: 'rescue_event', label: '抢救事件', timeKey: 'triggeredAt', summaryKeys: ['level', 'triggerDescription', 'status'],
    fields: [
      { key: 'eventType', label: '事件类型', required: true },
      { key: 'level', label: '级别', kind: 'select', required: true, options: option('mild', 'moderate', 'severe', 'critical') },
      { key: 'status', label: '状态', kind: 'select', required: true, options: option('active', 'closed', 'cancelled') },
      { key: 'triggerCode', label: '触发编码' },
      { key: 'triggerDescription', label: '触发描述', kind: 'textarea', required: true },
      { key: 'triggeredAt', label: '触发时间', kind: 'datetime', required: true },
      { key: 'outcome', label: '结局', kind: 'textarea' },
      { key: 'closedAt', label: '关闭时间', kind: 'datetime' },
      { key: 'closedBy', label: '关闭人编码' },
    ],
  },
  {
    entityType: 'rescue_action', label: '抢救动作', timeKey: 'occurredAt', summaryKeys: ['actionType', 'rescueEventLocalId'],
    fields: [
      { key: 'rescueEventLocalId', label: '抢救事件本地ID', required: true },
      { key: 'actionType', label: '动作类型', required: true },
      { key: 'payloadJson', label: '动作内容(JSON)', kind: 'textarea', required: true },
      { key: 'occurredAt', label: '发生时间', kind: 'datetime', required: true },
      { key: 'operatorId', label: '操作人编码' },
    ],
  },
];

const definitions = Object.fromEntries(STRUCTURED_RECORD_DEFINITIONS.map((item) => [item.entityType, item])) as Record<StructuredRecordEntityType, StructuredRecordDefinition>;
const numericKeys = new Set(['attemptNo', 'tidalVolumeMl', 'ratePerMin', 'peepCmh2o', 'fio2Percent', 'peakPressureCmh2o', 'etco2Mmhg', 'concentrationValue', 'rateValue', 'volume']);
const datetimeKeys = new Set(['occurredAt', 'effectiveAt', 'endedAt', 'startedAt', 'triggeredAt', 'closedAt']);

export function normalizeClinicalDateTime(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = dayjs(String(value));
  return parsed.isValid() ? parsed.format('YYYY-MM-DDTHH:mm:ssZ') : undefined;
}

export function buildStructuredRecordPayload(entityType: StructuredRecordEntityType, draft: StructuredRecordDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of definitions[entityType].fields) {
    const value = draft[field.key];
    if (value === null || value === undefined || value === '') continue;
    if (numericKeys.has(field.key)) {
      const numberValue = Number(value);
      if (Number.isFinite(numberValue)) payload[field.key] = numberValue;
    } else if (datetimeKeys.has(field.key)) {
      const normalized = normalizeClinicalDateTime(value);
      if (normalized) payload[field.key] = normalized;
    } else {
      payload[field.key] = String(value).trim();
    }
  }
  // 这些字段与页面唯一的显式临床时间同源，避免让操作者重复录入，也不使用浏览器当前时间补造。
  if (entityType === 'airway_record' && payload.occurredAt && !payload.insertedAt) payload.insertedAt = payload.occurredAt;
  if (entityType === 'ventilation_segment' && payload.effectiveAt && !payload.startTime) payload.startTime = payload.effectiveAt;
  if (entityType === 'infusion_segment' && payload.occurredAt && !payload.startTime) payload.startTime = payload.occurredAt;
  if (entityType === 'rescue_event' && payload.triggeredAt && !payload.occurredAt) payload.occurredAt = payload.triggeredAt;
  return payload;
}

export function validateStructuredRecordDraft(entityType: StructuredRecordEntityType, draft: StructuredRecordDraft): string | null {
  const definition = definitions[entityType];
  for (const field of definition.fields) {
    if (field.required && (draft[field.key] === null || draft[field.key] === undefined || String(draft[field.key]).trim() === '')) {
      return `请填写${field.label}`;
    }
  }
  for (const field of definition.fields.filter((item) => item.kind === 'datetime')) {
    if (draft[field.key] && !normalizeClinicalDateTime(draft[field.key])) return `${field.label}格式无效`;
  }
  if (entityType === 'ventilation_segment' && draft.fio2Percent !== undefined && draft.fio2Percent !== '') {
    const value = Number(draft.fio2Percent);
    if (!Number.isFinite(value) || value < 21 || value > 100) return 'FiO₂必须在21至100之间';
  }
  if (entityType === 'transfusion_verification' && String(draft.verifierOneId) === String(draft.verifierTwoId)) {
    return '两位核对人不能相同';
  }
  if (entityType === 'rescue_action') {
    try {
      JSON.parse(String(draft.payloadJson));
    } catch {
      return '动作内容必须是有效 JSON';
    }
  }
  return null;
}

export function resolveStructuredRecordOccurredAt(entityType: StructuredRecordEntityType, draft: StructuredRecordDraft): string | undefined {
  return normalizeClinicalDateTime(draft[definitions[entityType].timeKey]);
}

export function getStructuredRecordDefinition(entityType: StructuredRecordEntityType): StructuredRecordDefinition {
  return definitions[entityType];
}

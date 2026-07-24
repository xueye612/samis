import dayjs from 'dayjs';
import type { AnesthesiaMethodKey } from '@/mock/anesthesiaRecordPrototype';
import { getQuickEventOption } from '@/services/anesthesiaRecordMethodEngine';
import type { NumberedNoteLine } from '@/utils/numberedNotes';
import { parseNumberedNoteLines } from '@/utils/numberedNotes';
import type { SurgeryCase } from '@/types/anesthesia';
import { percentToTime } from '@/services/anesthesiaRecordEngine';

export type TimelineSyncField = 'roomInTime' | 'anesthesiaStart' | 'surgeryStart' | 'surgeryEnd' | 'anesthesiaEnd' | 'leaveRoomTime';

export interface MethodTimelineNode {
  key: string;
  label: string;
  eventType?: string;
  syncField?: TimelineSyncField;
  methods: AnesthesiaMethodKey[] | 'all';
  order: number;
}

const baseTimelineNodes: MethodTimelineNode[] = [
  { key: 'room-in', label: '入室', eventType: '入室', syncField: 'roomInTime', methods: 'all', order: 10 },
  { key: 'anes-start', label: '麻醉开始', eventType: '麻醉开始', syncField: 'anesthesiaStart', methods: 'all', order: 20 },
  { key: 'induction', label: '诱导开始', eventType: '诱导开始', methods: ['general'], order: 30 },
  { key: 'intubation', label: '插管/喉罩', eventType: '插管', methods: ['general'], order: 40 },
  { key: 'puncture', label: '穿刺', eventType: '穿刺', methods: ['neuraxial'], order: 40 },
  { key: 'positioning', label: '定位', eventType: '定位', methods: ['nerveBlock'], order: 40 },
  { key: 'sedation-start', label: '镇静开始', eventType: '镇静开始', methods: ['sedation'], order: 40 },
  { key: 'local', label: '局麻', eventType: '局麻', methods: ['local'], order: 40 },
  { key: 'catheter', label: '置管', eventType: '置管', methods: ['neuraxial'], order: 50 },
  { key: 'plane', label: '平面测定', eventType: '平面测定', methods: ['neuraxial'], order: 55 },
  { key: 'block-assess', label: '阻滞评估', eventType: '阻滞评估', methods: ['nerveBlock'], order: 55 },
  { key: 'surgery-start', label: '手术开始', eventType: '手术开始', syncField: 'surgeryStart', methods: 'all', order: 60 },
  { key: 'surgery-end', label: '手术结束', eventType: '手术结束', syncField: 'surgeryEnd', methods: 'all', order: 70 },
  { key: 'extubation', label: '拔管', eventType: '拔管', methods: ['general'], order: 80 },
  { key: 'anes-end', label: '麻醉结束', eventType: '麻醉结束', syncField: 'anesthesiaEnd', methods: 'all', order: 85 },
  { key: 'leave-room', label: '离室', eventType: '离室', syncField: 'leaveRoomTime', methods: 'all', order: 90 },
];

export function getMethodTimelineNodes(methods: AnesthesiaMethodKey[]): MethodTimelineNode[] {
  return baseTimelineNodes
    .filter((node) => node.methods === 'all' || node.methods.some((method) => methods.includes(method)))
    .sort((a, b) => a.order - b.order);
}

export function resolveTimelineNodeTime(record: SurgeryCase, node: MethodTimelineNode): string | undefined {
  if (node.syncField && record[node.syncField]) return record[node.syncField];
  // room-in 回退：旧 case_payload 快照可能把入室扫描(FIRST_SCANNING)落到 actualStart 而非 roomInTime，
  // 导致入室节点不显示。actualStart 保存了 HULI 入室扫描时间时，作为入室时间回退显示。
  if (node.syncField === 'roomInTime' && record.actualStart) return record.actualStart;
  if (!node.eventType) return undefined;
  const match = record.events.find((event) => event.type === node.eventType || event.type.includes(node.eventType!));
  return match?.time;
}

export function formatTimelineClock(value?: string) {
  return value ? dayjs(value).format('HH:mm') : '';
}

export function buildRecordClockIso(
  record: Pick<SurgeryCase, 'plannedStart' | 'anesthesiaStart'>,
  clock: string,
): string {
  const base = record.anesthesiaStart || record.plannedStart || dayjs().toISOString();
  const [hour, minute] = clock.split(':').map(Number);
  let candidate = dayjs(base).hour(hour).minute(minute).second(0).millisecond(0);
  const anchor = dayjs(base);
  // 仅把明显的午夜回绕（相差超过 12 小时）解释为次日；
  // 19:11 后录成同日 08:10 仍会被时间顺序校验拒绝，不能被静默“修正”。
  if (anchor.diff(candidate, 'minute') > 12 * 60) candidate = candidate.add(1, 'day');
  return candidate.toISOString();
}

export function buildRecordNowIso(record: Pick<SurgeryCase, 'plannedStart' | 'anesthesiaStart'>): string {
  return buildRecordClockIso(record, dayjs().format('HH:mm'));
}

export function resolveTimelineDragIso(
  record: Pick<SurgeryCase, 'plannedStart' | 'anesthesiaStart'>,
  clientX: number,
  track: { left: number; width: number },
  start: string,
  end: string,
): string {
  const width = Math.max(1, track.width);
  const percent = ((clientX - track.left) / width) * 100;
  return buildRecordClockIso(record, percentToTime(percent, start, end, 1));
}

export type TimelineValidationSeverity = 'ok' | 'warning' | 'error';

export interface TimelineTimeValidationResult {
  valid: boolean;
  message?: string;
  /** severity：error 为不可覆盖的硬错误；warning 为顺序异常，填原因+权限后可覆盖保存。 */
  severity?: TimelineValidationSeverity;
  /** 顺序异常（可覆盖），由保存流程据此要求原因与确认。 */
  orderConflict?: boolean;
  /** 冲突节点及时间，供前端展示。 */
  conflicts?: Array<{ label: string; time: string }>;
}

/**
 * 关键时间必须服从当前麻醉方式对应的临床先后顺序。
 * 允许相邻节点记录在同一分钟，但不得越过已经记录的前一/后一节点。
 *
 * 顺序异常不再硬拦截：返回 severity=warning + orderConflict=true，
 * 由保存流程要求填写原因并确认后覆盖保存（审计标记 timeline_order_override）。
 * 无效时间/不属于节点仍为 error，不可覆盖。
 */
export function validateTimelineNodeTime(
  record: SurgeryCase,
  methods: AnesthesiaMethodKey[],
  node: MethodTimelineNode,
  isoTime: string,
): TimelineTimeValidationResult {
  const candidate = dayjs(isoTime);
  if (!candidate.isValid()) return { valid: false, severity: 'error', message: `${node.label}时间无效` };

  const states = buildTimelineNodeStates(record, methods);
  const index = states.findIndex((item) => item.key === node.key);
  if (index < 0) {
    // 普通术中事件也允许拖动，但只能位于患者入室与离室窗口内；
    // 它们不参与“诱导→插管→手术”等麻醉方式节点的严格排序。
    if (!node.key.startsWith('event-')) {
      return { valid: false, severity: 'error', message: `${node.label}不属于当前麻醉方式的关键时间` };
    }
    if (record.roomInTime && candidate.isBefore(dayjs(record.roomInTime))) {
      return { valid: false, severity: 'error', orderConflict: false, message: `${node.label}不得早于入室（${formatTimelineClock(record.roomInTime)}）` };
    }
    if (record.leaveRoomTime && candidate.isAfter(dayjs(record.leaveRoomTime))) {
      return { valid: false, severity: 'error', orderConflict: false, message: `${node.label}不得晚于离室（${formatTimelineClock(record.leaveRoomTime)}）` };
    }
    return { valid: true, severity: 'ok' };
  }

  const previous = states.slice(0, index).reverse().find((item) => item.recorded && item.time);
  if (previous?.time && candidate.isBefore(dayjs(previous.time))) {
    return {
      valid: false,
      severity: 'warning',
      orderConflict: true,
      message: `${node.label}早于${previous.label}（${formatTimelineClock(previous.time)}），请确认时间是否准确。若属于补录或特殊情况，请填写原因后保存。`,
      conflicts: [{ label: previous.label, time: previous.time }],
    };
  }

  const next = states.slice(index + 1).find((item) => item.recorded && item.time);
  if (next?.time && candidate.isAfter(dayjs(next.time))) {
    return {
      valid: false,
      severity: 'warning',
      orderConflict: true,
      message: `${node.label}晚于${next.label}（${formatTimelineClock(next.time)}），请确认时间是否准确。若属于补录或特殊情况，请填写原因后保存。`,
      conflicts: [{ label: next.label, time: next.time }],
    };
  }

  return { valid: true, severity: 'ok' };
}

export function buildTimedKeyOperationNoteLines(
  record: SurgeryCase,
  methods: AnesthesiaMethodKey[],
): NumberedNoteLine[] {
  const seen = new Set<string>();
  return buildTimelineNodeStates(record, methods)
    .filter((node) => node.recorded && node.time)
    .filter((node) => {
      const key = node.label.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((node, offset) => {
      const clock = formatTimelineClock(node.time);
      const content = `${clock} ${node.label}`;
      return {
        index: offset + 1,
        content,
        raw: `${offset + 1}. ${content}`,
        clock,
        displayContent: node.label,
      };
    });
}

export function resolveKeyOperationsDisplayText(
  record: SurgeryCase,
  methods: AnesthesiaMethodKey[],
  stored?: string,
  fallbackPlain = '无',
): string {
  const fromNotes = parseNumberedNoteLines(stored ?? '');
  if (fromNotes.some((line) => line.clock)) {
    const seen = new Set<string>();
    return fromNotes
      .filter((line) => {
        const key = (line.displayContent || line.content).trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((line, index) => `${index + 1}. ${line.content}`)
      .join('\n');
  }
  const fromTimeline = buildTimedKeyOperationNoteLines(record, methods);
  if (fromTimeline.length) {
    return fromTimeline.map((line) => `${line.index}. ${line.content}`).join('\n');
  }
  return stored ?? fallbackPlain;
}

export type TimelineNodeSource = 'HULI扫描' | 'HULI原始(已修正)' | '人工录入' | '快捷事件' | '设备采集' | '未记录';

/** 判定关键时间节点数据来源：入室/离室可能来自 HULI 扫描，其余为 SAMIS 维护。 */
export function resolveTimelineNodeSource(record: SurgeryCase, node: MethodTimelineNode): TimelineNodeSource {
  if (node.syncField === 'roomInTime') {
    return record.originalRoomInTime ? 'HULI原始(已修正)' : 'HULI扫描';
  }
  if (node.syncField === 'leaveRoomTime') {
    return record.originalLeaveRoomTime ? 'HULI原始(已修正)' : 'HULI扫描';
  }
  const recorded = Boolean(resolveTimelineNodeTime(record, node));
  return recorded ? '人工录入' : '未记录';
}

export function buildTimelineNodeStates(record: SurgeryCase, methods: AnesthesiaMethodKey[]) {
  return getMethodTimelineNodes(methods).map((node) => ({
    ...node,
    time: resolveTimelineNodeTime(record, node),
    recorded: Boolean(resolveTimelineNodeTime(record, node)),
    source: resolveTimelineNodeSource(record, node),
  }));
}

/** 清除已记录关键时间（置空 syncField 并移除对应事件），不物理删除历史审计。 */
export function clearTimelineNodeTime(record: SurgeryCase, node: MethodTimelineNode): void {
  if (node.syncField) {
    if (node.syncField === 'roomInTime') record.roomInTime = undefined;
    if (node.syncField === 'anesthesiaStart') record.anesthesiaStart = undefined;
    if (node.syncField === 'surgeryStart') record.surgeryStart = undefined;
    if (node.syncField === 'surgeryEnd') record.surgeryEnd = undefined;
    if (node.syncField === 'anesthesiaEnd') record.anesthesiaEnd = undefined;
    if (node.syncField === 'leaveRoomTime') record.leaveRoomTime = undefined;
  }
  const eventType = node.eventType;
  if (eventType) {
    const idx = record.events.findIndex((event) => event.type === eventType || event.type.includes(eventType));
    if (idx >= 0) record.events.splice(idx, 1);
  }
}

export function buildMilestoneStatusEvents(record: SurgeryCase) {
  const synthetic: Array<{ id: string; type: string; time: string; severity: '轻度'; stage: '术中'; treatment: string; staff: string[]; reported: boolean; qualityIncluded: boolean }> = [];
  const push = (type: string, time?: string, idSuffix = type) => {
    if (!time) return;
    synthetic.push({
      id: `milestone-${idSuffix}`,
      type,
      time,
      stage: '术中',
      severity: '轻度',
      treatment: '',
      staff: [],
      reported: false,
      qualityIncluded: false,
    });
  };
  push('入室', record.roomInTime ?? record.events.find((e) => e.type.includes('入室'))?.time, 'room-in');
  push('麻醉开始', record.anesthesiaStart, 'anes-start');
  push('手术开始', record.surgeryStart, 'surgery-start');
  push('手术结束', record.surgeryEnd, 'surgery-end');
  push('麻醉结束', record.anesthesiaEnd ?? record.events.find((e) => e.type.includes('麻醉结束'))?.time, 'anes-end');
  push('离室', record.leaveRoomTime, 'leave-room');
  return synthetic;
}

const setCaseTimeField = (record: SurgeryCase, field: TimelineSyncField, value: string) => {
  if (field === 'roomInTime') record.roomInTime = value;
  if (field === 'anesthesiaStart') record.anesthesiaStart = value;
  if (field === 'surgeryStart') record.surgeryStart = value;
  if (field === 'surgeryEnd') record.surgeryEnd = value;
  if (field === 'anesthesiaEnd') record.anesthesiaEnd = value;
  if (field === 'leaveRoomTime') record.leaveRoomTime = value;
};

export function applyTimelineNodeTime(record: SurgeryCase, node: MethodTimelineNode, isoTime: string) {
  if (node.syncField) setCaseTimeField(record, node.syncField, isoTime);
  const option = node.eventType ? getQuickEventOption(node.eventType) : undefined;
  if (option?.syncField) setCaseTimeField(record, option.syncField, isoTime);
  const existing = record.events.find((event) => event.type === node.eventType || (node.eventType && event.type.includes(node.eventType)));
  if (existing) {
    existing.time = isoTime;
    return existing;
  }
  if (!node.eventType) return undefined;
  const event = {
    id: `timeline-${node.key}-${Date.now()}`,
    type: node.eventType,
    time: isoTime,
    stage: option?.stage ?? '术中',
    severity: option?.severity ?? '轻度',
    treatment: `时间轴节点：${node.label}`,
    staff: [record.anesthesiologist, record.anesthesiaNurse].filter(Boolean),
    reported: false,
    qualityIncluded: false,
  };
  record.events.push(event);
  if (node.eventType.includes('插管') || node.eventType.includes('喉罩')) {
    record.airwayRecord = {
      ...(record.airwayRecord ?? {}),
      intubationTime: isoTime,
      intubationMethod: node.eventType.includes('喉罩') ? '喉罩' : '气管插管',
    };
  }
  if (node.eventType.includes('拔管')) {
    record.airwayRecord = { ...(record.airwayRecord ?? {}), extubationTime: isoTime };
  }
  return event;
}

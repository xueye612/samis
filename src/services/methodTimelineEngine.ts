import dayjs from 'dayjs';
import type { AnesthesiaMethodKey } from '@/mock/anesthesiaRecordPrototype';
import { getQuickEventOption } from '@/services/anesthesiaRecordMethodEngine';
import type { NumberedNoteLine } from '@/utils/numberedNotes';
import { parseNumberedNoteLines } from '@/utils/numberedNotes';
import type { SurgeryCase } from '@/types/anesthesia';

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
  const base = record.plannedStart || record.anesthesiaStart || dayjs().toISOString();
  const [hour, minute] = clock.split(':').map(Number);
  return dayjs(base).hour(hour).minute(minute).second(0).millisecond(0).toISOString();
}

export function buildRecordNowIso(record: Pick<SurgeryCase, 'plannedStart' | 'anesthesiaStart'>): string {
  return buildRecordClockIso(record, dayjs().format('HH:mm'));
}

export function buildTimedKeyOperationNoteLines(
  record: SurgeryCase,
  methods: AnesthesiaMethodKey[],
): NumberedNoteLine[] {
  return buildTimelineNodeStates(record, methods)
    .filter((node) => node.recorded && node.time)
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
  if (fromNotes.some((line) => line.clock)) return stored ?? '';
  const fromTimeline = buildTimedKeyOperationNoteLines(record, methods);
  if (fromTimeline.length) {
    return fromTimeline.map((line) => `${line.index}. ${line.content}`).join('\n');
  }
  return stored ?? fallbackPlain;
}

export function buildTimelineNodeStates(record: SurgeryCase, methods: AnesthesiaMethodKey[]) {
  return getMethodTimelineNodes(methods).map((node) => ({
    ...node,
    time: resolveTimelineNodeTime(record, node),
    recorded: Boolean(resolveTimelineNodeTime(record, node)),
  }));
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

import type { QuickEventOption, IntraopStage, SurgeryScenarioKey, AnesthesiaMethodKey } from '@/mock/anesthesiaRecordPrototype';
import type { SurgeryCase } from '@/types/anesthesia';
import type { AnesthesiaSyncState } from '@/types/anesthesiaLocalDb';
import {
  getQuickEventOption,
  getStageQuickEvents,
  isQuickEventDone,
} from '@/services/anesthesiaRecordMethodEngine';
import { quickEventOptions } from '@/mock/anesthesiaRecordPrototype';
import { buildRecordEntryVisibility, type RecordEntryVisibility } from './recordActionRules';

/** 纸面快捷条外露事件（临床里程碑 + 常见异常） */
export const SHEET_PRIMARY_EVENT_NAMES = [
  '低血压',
  '升压药',
  '手术开始',
  '手术结束',
  '插管',
  '拔管',
] as const;

export type SheetEntryAction =
  | 'medication'
  | 'infusion'
  | 'transfusion'
  | 'autologous'
  | 'vital'
  | 'output-urine'
  | 'output-blood'
  | 'output-drainage'
  | 'lab';

export interface QuickEventButtonState {
  name: string;
  disabled: boolean;
  title?: string;
}

export interface SheetQuickActionState {
  entries: RecordEntryVisibility;
  primaryEvents: QuickEventButtonState[];
  moreEvents: QuickEventButtonState[];
  hasMoreEvents: boolean;
}

export function resolveSheetQuickEvents(
  item: Pick<SurgeryCase, 'events' | 'roomInTime' | 'anesthesiaStart' | 'surgeryStart' | 'surgeryEnd' | 'anesthesiaEnd' | 'leaveRoomTime' | 'locked' | 'recordStatus' | 'signatures'>,
  stage: IntraopStage,
  methods: AnesthesiaMethodKey[],
  selectedTemplate: string,
  scenario: SurgeryScenarioKey | undefined,
  rescueActive: boolean,
): SheetQuickActionState {
  const entries = buildRecordEntryVisibility(item, rescueActive);
  const pool = getStageQuickEvents(stage, methods, selectedTemplate, scenario);
  const seen = new Set<string>();
  const ordered: QuickEventOption[] = [];

  const push = (name: string) => {
    if (seen.has(name)) return;
    const option = pool.find((event) => event.name === name)
      ?? quickEventOptions.find((event) => event.name === name);
    if (!option) return;
    seen.add(name);
    ordered.push(option);
  };

  SHEET_PRIMARY_EVENT_NAMES.forEach((name) => push(name));
  pool.forEach((event) => push(event.name));
  quickEventOptions.forEach((event) => push(event.name));

  const toButton = (option: QuickEventOption): QuickEventButtonState => {
    const disabled = !entries.canQuickEvent || isQuickEventDone(item, option);
    return {
      name: option.name,
      disabled,
      title: disabled && isQuickEventDone(item, option) ? '已记录' : option.name,
    };
  };

  const primaryEvents = SHEET_PRIMARY_EVENT_NAMES
    .map((name) => ordered.find((event) => event.name === name))
    .filter(Boolean)
    .map((option) => toButton(option!));

  const primarySet = new Set(SHEET_PRIMARY_EVENT_NAMES);
  const moreEvents = ordered
    .filter((option) => !primarySet.has(option.name as typeof SHEET_PRIMARY_EVENT_NAMES[number]))
    .slice(0, 24)
    .map(toButton);

  return {
    entries,
    primaryEvents,
    moreEvents,
    hasMoreEvents: moreEvents.length > 0,
  };
}

export function entryActionDisabled(
  entries: RecordEntryVisibility,
  action: SheetEntryAction,
): boolean {
  if (!entries.canEdit) return true;
  switch (action) {
    case 'medication':
      return !entries.canMedication;
    case 'infusion':
      return !entries.canFluid;
    case 'transfusion':
    case 'autologous':
      return !entries.canTransfusion;
    case 'vital':
      return !entries.canVital;
    case 'output-urine':
    case 'output-blood':
    case 'output-drainage':
      return !entries.canOutput;
    case 'lab':
      return !entries.canLab;
    default:
      return true;
  }
}

export function syncNeedsAttention(sync: AnesthesiaSyncState): boolean {
  return !sync.online
    || sync.conflictCount > 0
    || sync.failedCount > 0
    || sync.pendingCount > 0;
}

export function quickEventLabel(name: string): string {
  return getQuickEventOption(name).name;
}

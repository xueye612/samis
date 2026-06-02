import dayjs from 'dayjs';
import type { MedicationRecord } from '@/types/anesthesia';
import { clockToMinutes, isoOrClockToClock, LIVE_DEFAULT_SEGMENT_MINUTES, addMinutesToClock } from '@/services/anesthesiaRecordEngine';
import { resolveMedicationSpecialReason } from '@/services/drugDictRecommend';

/** 前端录入用中文 mode；持久化/API 可用 single | continuous | intermittent */
export type MedicationModeCode = 'single' | 'continuous' | 'intermittent';
export type MedicationModeLabel = MedicationRecord['mode'];

const MODE_TO_CODE: Record<MedicationModeLabel, MedicationModeCode> = {
  单次用药: 'single',
  持续泵入: 'continuous',
  间断追加: 'intermittent',
};

const CODE_TO_MODE: Record<MedicationModeCode, MedicationModeLabel> = {
  single: '单次用药',
  continuous: '持续泵入',
  intermittent: '间断追加',
};

export function normalizeMedicationMode(mode?: string): MedicationModeLabel {
  if (!mode) return '单次用药';
  if (mode in MODE_TO_CODE) return mode as MedicationModeLabel;
  if (mode in CODE_TO_MODE) return CODE_TO_MODE[mode as MedicationModeCode];
  if (mode === 'continuous') return '持续泵入';
  if (mode === 'intermittent') return '间断追加';
  if (mode === 'single') return '单次用药';
  return '单次用药';
}

export function medicationModeToApiCode(mode?: string): MedicationModeCode {
  return MODE_TO_CODE[normalizeMedicationMode(mode)];
}

export function medicationEventTime(record: Pick<MedicationRecord, 'time' | 'startTime' | 'eventTime'>): string | undefined {
  return record.eventTime ?? record.time ?? record.startTime;
}

export function medicationStartTime(record: Pick<MedicationRecord, 'time' | 'startTime'>): string | undefined {
  return record.startTime ?? record.time;
}

export function medicationEndTime(record: Pick<MedicationRecord, 'endTime' | 'stopTime'>): string | undefined {
  return record.stopTime ?? record.endTime;
}

function hasPositiveDuration(start?: string, end?: string): boolean {
  const startM = clockToMinutes(isoOrClockToClock(start));
  const endM = clockToMinutes(isoOrClockToClock(end));
  if (startM === null || endM === null) return false;
  return endM > startM;
}

/** 是否持续发生、应在时间轴画线段（与 is_special 无关） */
export function shouldRenderAsLine(record: Pick<MedicationRecord, 'mode' | 'time' | 'startTime' | 'endTime' | 'stopTime'>): boolean {
  const mode = normalizeMedicationMode(record.mode);
  if (mode === '间断追加' || mode === '单次用药') return false;
  if (mode === '持续泵入') return true;
  const start = medicationStartTime(record);
  const end = medicationEndTime(record);
  return Boolean(start && end && hasPositiveDuration(start, end));
}

/** 是否仅在时间点展示标记（单次/间断，或无有效持续区间） */
export function shouldRenderAsPoint(record: Pick<MedicationRecord, 'mode' | 'time' | 'startTime' | 'endTime' | 'stopTime' | 'eventTime'>): boolean {
  return !shouldRenderAsLine(record);
}

/** 是否进入下方特殊用药说明区（与是否画线无关） */
export function shouldRenderInSpecialMedication(record: Pick<MedicationRecord, 'isSpecial'>): boolean {
  return Boolean(record.isSpecial);
}

const CIRCLE_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

export function formatSpecialNo(value?: number | string): string {
  if (value === undefined || value === null || value === '') return '';
  const num = typeof value === 'number' ? value : Number(String(value).replace(/\D/g, ''));
  if (Number.isFinite(num) && num >= 1 && num <= CIRCLE_NUMBERS.length) return CIRCLE_NUMBERS[num - 1];
  return String(value);
}

export function parseSpecialNoFromDisplay(text?: string): number | undefined {
  if (!text) return undefined;
  const idx = CIRCLE_NUMBERS.indexOf(text.trim());
  if (idx >= 0) return idx + 1;
  const num = Number(text);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

export interface MedicationDisplayModel {
  renderAsLine: boolean;
  renderAsPoint: boolean;
  showInSpecialSection: boolean;
  time: string;
  segmentEnd?: string;
  pointLabel: string;
  lineLabel: string;
  specialNo?: number;
  specialNoDisplay: string;
}

export function resolveSegmentEndForLine(
  record: Pick<MedicationRecord, 'mode' | 'time' | 'startTime' | 'endTime' | 'stopTime'>,
  fallbackEnd?: string,
): string | undefined {
  const stored = medicationEndTime(record);
  if (stored) return stored;
  const start = medicationStartTime(record);
  if (!start) return fallbackEnd;
  if (normalizeMedicationMode(record.mode) === '持续泵入') {
    return addMinutesToClock(isoOrClockToClock(start), LIVE_DEFAULT_SEGMENT_MINUTES);
  }
  return fallbackEnd ?? start;
}

export function buildMedicationDisplayModel(
  record: MedicationRecord,
  options: { fallbackSheetEnd?: string; specialNo?: number } = {},
): MedicationDisplayModel {
  const renderAsLine = shouldRenderAsLine(record);
  const renderAsPoint = shouldRenderAsPoint(record);
  const showInSpecialSection = shouldRenderInSpecialMedication(record);
  const time = medicationEventTime(record) ?? medicationStartTime(record) ?? '';
  const segmentEnd = renderAsLine ? resolveSegmentEndForLine(record, options.fallbackSheetEnd) : undefined;
  const doseText = `${record.dose ?? ''}${record.unit ?? ''}`.trim();
  const specialNo = record.specialNo ?? options.specialNo;
  const specialNoDisplay = formatSpecialNo(specialNo);
  const pointLabel = showInSpecialSection && renderAsPoint && specialNoDisplay
    ? specialNoDisplay
    : (record.displayText?.trim() || doseText || record.pumpRate || record.drug);
  const lineLabel = record.pumpRate
    ? `${record.drug} ${record.pumpRate}`
    : (record.displayText?.trim() || `${record.drug} ${doseText}`.trim());
  return {
    renderAsLine,
    renderAsPoint,
    showInSpecialSection,
    time,
    segmentEnd,
    pointLabel,
    lineLabel: lineLabel.trim() || record.drug,
    specialNo: typeof specialNo === 'number' ? specialNo : parseSpecialNoFromDisplay(String(specialNo ?? '')),
    specialNoDisplay,
  };
}

export function assignSpecialNumbers(records: MedicationRecord[]): Map<string, number> {
  const special = records
    .filter((row) => row.status !== 'voided' && shouldRenderInSpecialMedication(row))
    .sort((a, b) => String(medicationEventTime(a) ?? medicationStartTime(a)).localeCompare(String(medicationEventTime(b) ?? medicationStartTime(b))));
  const map = new Map<string, number>();
  let next = 1;
  special.forEach((row) => {
    const existing = row.specialNo ?? parseSpecialNoFromDisplay(String(row.specialNo ?? ''));
    if (existing) {
      map.set(row.id, existing);
      next = Math.max(next, existing + 1);
      return;
    }
    map.set(row.id, next);
    next += 1;
  });
  return map;
}

export function formatMedicationSpecialNoteLine(record: MedicationRecord, specialNo: number): string {
  const prefix = formatSpecialNo(specialNo);
  const mode = normalizeMedicationMode(record.mode);
  const start = isoOrClockToClock(medicationStartTime(record) ?? medicationEventTime(record));
  const end = isoOrClockToClock(medicationEndTime(record));
  const dose = `${record.dose ?? ''}${record.unit ?? ''}`.trim();
  const route = record.route ? ` ${record.route}` : '';
  const detail = resolveMedicationSpecialReason(record);
  if (mode === '持续泵入' && start) {
    const range = end && end !== start ? `${start}-${end}` : `${start}`;
    const rate = record.pumpRate ? ` ${record.pumpRate}` : (dose ? ` ${dose}` : '');
    const tail = detail ? `，${detail}` : '';
    return `${prefix} ${range} ${record.drug}${rate}${tail}`.trim();
  }
  const clock = isoOrClockToClock(medicationEventTime(record) ?? record.time) || start || '';
  const tail = detail ? `，${detail}` : '';
  return `${prefix} ${clock} ${record.drug}${dose ? ` ${dose}` : ''}${route}${tail}`.trim();
}

export function buildSpecialMedicationSummaryText(records: MedicationRecord[]): string {
  const active = records.filter((row) => row.status !== 'voided' && shouldRenderInSpecialMedication(row));
  if (!active.length) return '';
  const numbers = assignSpecialNumbers(records);
  return active
    .map((row) => formatMedicationSpecialNoteLine(row, numbers.get(row.id) ?? row.specialNo ?? 1))
    .join('\n');
}

export function mergeSpecialMedicationNotes(manualNotes: string | undefined, records: MedicationRecord[]): string {
  const auto = buildSpecialMedicationSummaryText(records);
  const manual = manualNotes?.trim();
  if (manual && auto) {
    const manualLines = manual.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const autoLines = auto.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const seen = new Set(manualLines.map((line) => line.replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩\d]+[.、)\s]*/, '')));
    const merged = [...manualLines];
    autoLines.forEach((line) => {
      const key = line.replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩\d]+[.、)\s]*/, '');
      if (!seen.has(key)) merged.push(line);
    });
    return merged.join('\n');
  }
  return manual || auto || '';
}

/** 录入归一化：持续泵入补默认结束时间；is_special 仅以 payload 或显式字典推荐为准 */
export function normalizeMedicationRecordFields(
  payload: Partial<MedicationRecord>,
  options?: {
    applyDrugDefaults?: boolean;
    drugDefaults?: { defaultMode?: MedicationModeLabel; defaultIsSpecial?: boolean };
  },
): Partial<MedicationRecord> {
  const drugDefaults = options?.drugDefaults;
  const mode = normalizeMedicationMode(payload.mode ?? (options?.applyDrugDefaults ? drugDefaults?.defaultMode : undefined));
  const isSpecial = payload.isSpecial !== undefined
    ? payload.isSpecial
    : (options?.applyDrugDefaults ? Boolean(drugDefaults?.defaultIsSpecial) : false);
  const start = payload.startTime ?? payload.time;
  const patch: Partial<MedicationRecord> = {
    ...payload,
    mode,
    isSpecial,
    time: mode === '单次用药' || mode === '间断追加' ? (payload.time ?? payload.eventTime ?? start) : payload.time,
    eventTime: mode === '单次用药' || mode === '间断追加' ? (payload.eventTime ?? payload.time ?? start) : payload.eventTime,
    startTime: mode === '持续泵入' ? start : payload.startTime,
  };
  if (mode === '持续泵入' && start && !payload.endTime && !payload.stopTime) {
    const end = dayjs(start).add(LIVE_DEFAULT_SEGMENT_MINUTES, 'minute').toISOString();
    patch.endTime = end;
    patch.stopTime = end;
  }
  if (mode === '单次用药' || mode === '间断追加') {
    patch.endTime = undefined;
    patch.stopTime = undefined;
  }
  return patch;
}

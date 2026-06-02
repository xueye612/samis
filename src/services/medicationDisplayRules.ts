import dayjs from 'dayjs';
import type { MedicationRecord, SurgeryCase } from '@/types/anesthesia';
import {
  clockToMinutes,
  isoOrClockToClock,
  LIVE_DEFAULT_SEGMENT_MINUTES,
  addMinutesToClock,
  timeToPercent,
} from '@/services/anesthesiaRecordEngine';
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

/** 线段宽度低于此比例不显示文字（避免压网格） */
export const LINE_LABEL_MIN_PERCENT = 5;
/** 非特殊持续用药：低于此比例不显示剂量 */
export const LINE_LABEL_DOSE_MIN_PERCENT = 10;
/** 特殊持续用药：低于此比例仅显示编号 */
export const LINE_LABEL_SPECIAL_COMFORT_PERCENT = 14;

export type MedicationLineLabelMode = 'hidden' | 'special-no' | 'short' | 'full-short';

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

/** 是否进入下方特殊用药说明区（仅 is_special=true） */
export function shouldRenderInSpecialMedication(record: Pick<MedicationRecord, 'isSpecial'>): boolean {
  return Boolean(record.isSpecial);
}

/** 诱导期结束事件（首次出现即视为诱导结束） */
const INDUCTION_END_EVENT_KEYS = ['插管', '喉罩', '手术开始', '切皮', '阻滞评估', '单肺通气', '内镜开始', '置管'];

/** 解析诱导用药时间窗：入室/麻醉开始 → 插管/手术开始等 */
export function resolveInductionWindow(
  record: Pick<SurgeryCase, 'roomInTime' | 'anesthesiaStart' | 'surgeryStart' | 'events'>,
): { startIso?: string; endIso?: string } {
  const events = (record.events ?? []).filter((item) => item.status !== 'voided');
  const startCandidates = [
    record.roomInTime,
    record.anesthesiaStart,
    ...events
      .filter((item) => ['诱导开始', '镇静开始'].some((key) => item.type.includes(key)))
      .map((item) => item.time),
  ].filter(Boolean) as string[];
  const endCandidates = [
    record.surgeryStart,
    ...events
      .filter((item) => INDUCTION_END_EVENT_KEYS.some((key) => item.type.includes(key)))
      .map((item) => item.time),
  ].filter(Boolean) as string[];
  const pickEarliest = (list: string[]) => list.reduce((earliest, current) => (
    new Date(current).getTime() < new Date(earliest).getTime() ? current : earliest
  ));
  return {
    startIso: startCandidates.length ? pickEarliest(startCandidates) : undefined,
    endIso: endCandidates.length ? pickEarliest(endCandidates) : undefined,
  };
}

function medicationEventIso(record: MedicationRecord): string | undefined {
  return medicationStartTime(record) ?? medicationEventTime(record) ?? record.time;
}

/** 是否写入「麻醉诱导用药」说明区：非特殊用药，且给药时间在诱导时间窗内 */
export function shouldRenderInInductionMedication(
  record: MedicationRecord,
  context: Pick<SurgeryCase, 'roomInTime' | 'anesthesiaStart' | 'surgeryStart' | 'events'>,
): boolean {
  if (record.status === 'voided' || shouldRenderInSpecialMedication(record)) return false;
  const eventIso = medicationEventIso(record);
  if (!eventIso) return false;
  const eventMs = new Date(eventIso).getTime();
  if (Number.isNaN(eventMs)) return false;
  const { startIso, endIso } = resolveInductionWindow(context);
  if (!startIso && !endIso) return false;
  if (startIso && eventMs < new Date(startIso).getTime()) return false;
  if (endIso && eventMs >= new Date(endIso).getTime()) return false;
  return true;
}

export function formatInductionMedicationNoteLine(record: MedicationRecord, index: number): string {
  const dose = `${record.dose ?? ''}${record.unit ?? ''}`.trim();
  const route = record.route?.trim() || '静注';
  const clock = isoOrClockToClock(medicationEventTime(record) ?? record.time ?? record.startTime);
  const drugPart = `${record.drug}${dose ? ` ${dose}` : ''} ${route}`.trim();
  return clock ? `${index}. ${clock} ${drugPart}` : `${index}. ${drugPart}`;
}

export function buildInductionMedicationSummaryText(
  records: MedicationRecord[],
  context: Pick<SurgeryCase, 'roomInTime' | 'anesthesiaStart' | 'surgeryStart' | 'events'>,
): string {
  const rows = records
    .filter((row) => shouldRenderInInductionMedication(row, context))
    .sort((a, b) => medicationSortMinutes(a) - medicationSortMinutes(b));
  return rows.map((row, index) => formatInductionMedicationNoteLine(row, index + 1)).join('\n');
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

/** 时间轴点标记：仅剂量+单位（不含药名） */
export function formatMedicationDoseLabel(record: Pick<MedicationRecord, 'dose' | 'unit' | 'pumpRate'>): string {
  const dose = `${record.dose ?? ''}${record.unit ?? ''}`.trim();
  if (dose) return dose;
  return record.pumpRate?.trim() ?? '';
}

/** 线段上简短标注：泵速优先，否则剂量（不含药名） */
export function formatMedicationShortLineLabel(record: Pick<MedicationRecord, 'dose' | 'unit' | 'pumpRate'>): string {
  const pump = record.pumpRate?.trim();
  if (pump) return pump;
  return formatMedicationDoseLabel(record);
}

export function computeMedicationSegmentWidthPercent(
  start?: string,
  end?: string,
  sheetStart?: string,
  sheetEnd?: string,
): number {
  if (!start || !sheetStart || !sheetEnd) return 0;
  const left = timeToPercent(isoOrClockToClock(start), sheetStart, sheetEnd);
  const right = timeToPercent(isoOrClockToClock(end ?? start), sheetStart, sheetEnd);
  return Math.max(0, Number((right - left).toFixed(4)));
}

export function resolveMedicationPointLabel(
  record: MedicationRecord,
  options: { showInSpecialSection: boolean; specialNoDisplay: string },
): string {
  if (options.showInSpecialSection && options.specialNoDisplay) {
    return options.specialNoDisplay;
  }
  const dose = formatMedicationDoseLabel(record);
  return dose || '·';
}

export function resolveMedicationLineLabel(
  record: MedicationRecord,
  options: {
    segmentWidthPercent: number;
    showInSpecialSection: boolean;
    specialNoDisplay: string;
  },
): { lineLabel: string; lineLabelMode: MedicationLineLabelMode } {
  const width = options.segmentWidthPercent;
  const short = formatMedicationShortLineLabel(record);
  const specialNo = options.showInSpecialSection ? options.specialNoDisplay : '';

  if (width < LINE_LABEL_MIN_PERCENT) {
    return { lineLabel: '', lineLabelMode: 'hidden' };
  }

  if (options.showInSpecialSection) {
    if (width < LINE_LABEL_SPECIAL_COMFORT_PERCENT && specialNo) {
      return { lineLabel: specialNo, lineLabelMode: 'special-no' };
    }
    if (short && width >= LINE_LABEL_SPECIAL_COMFORT_PERCENT) {
      return { lineLabel: short, lineLabelMode: 'full-short' };
    }
    if (specialNo) return { lineLabel: specialNo, lineLabelMode: 'special-no' };
    return short
      ? { lineLabel: short, lineLabelMode: 'short' }
      : { lineLabel: '', lineLabelMode: 'hidden' };
  }

  if (!short || width < LINE_LABEL_DOSE_MIN_PERCENT) {
    return { lineLabel: '', lineLabelMode: 'hidden' };
  }
  return {
    lineLabel: short,
    lineLabelMode: width >= LINE_LABEL_SPECIAL_COMFORT_PERCENT ? 'full-short' : 'short',
  };
}

export function buildFluidMarkerTooltip(
  record: { name: string; volume?: number; unit?: string; time?: string; startTime?: string; endTime?: string; remark?: string },
  bandLabel?: string,
): string {
  const parts: string[] = [record.name];
  if (bandLabel) parts.unshift(bandLabel);
  const start = isoOrClockToClock(record.startTime ?? record.time);
  const end = isoOrClockToClock(record.endTime);
  if (start && end && end !== start) {
    parts.push(`${start} — ${end}`);
    const duration = formatSegmentDurationLabel(start, end);
    if (duration) parts.push(`时长 ${duration}`);
  } else if (start) {
    parts.push(start);
  }
  const amount = `${record.volume ?? ''}${record.unit ?? ''}`.trim();
  if (amount) parts.push(amount);
  if (record.remark?.trim()) parts.push(record.remark.trim());
  return parts.join(' · ');
}

export function buildMedicationMarkerTooltip(
  record: MedicationRecord,
  options: { specialNo?: number; sheetStart?: string; sheetEnd?: string } = {},
): string {
  const parts: string[] = [record.drug];
  const mode = normalizeMedicationMode(record.mode);
  const start = isoOrClockToClock(medicationStartTime(record) ?? medicationEventTime(record));
  const end = isoOrClockToClock(medicationEndTime(record));
  if (mode === '持续泵入' && start) {
    parts.push(end && end !== start ? `${start} — ${end}` : start);
    const duration = formatSegmentDurationLabel(start, end);
    if (duration) parts.push(`时长 ${duration}`);
  } else if (start) {
    parts.push(start);
  }
  const dose = formatMedicationDoseLabel(record);
  if (dose) parts.push(dose);
  if (record.pumpRate?.trim() && record.pumpRate.trim() !== dose) {
    parts.push(record.pumpRate.trim());
  }
  if (record.route?.trim()) parts.push(record.route.trim());
  if (options.specialNo) parts.push(`特殊用药 ${formatSpecialNo(options.specialNo)}`);
  const detail = resolveMedicationSpecialReason(record);
  if (detail) parts.push(detail);
  return parts.join(' · ');
}

export interface MedicationDisplayModel {
  renderAsLine: boolean;
  renderAsPoint: boolean;
  showInSpecialSection: boolean;
  time: string;
  segmentEnd?: string;
  segmentWidthPercent: number;
  pointLabel: string;
  lineLabel: string;
  lineLabelMode: MedicationLineLabelMode;
  markerTooltip: string;
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

export function formatSegmentDurationLabel(start?: string, end?: string, sheetStart?: string, sheetEnd?: string): string {
  const startM = clockToMinutes(isoOrClockToClock(start));
  const endM = clockToMinutes(isoOrClockToClock(end));
  if (startM === null || endM === null || endM <= startM) return '';
  const mins = endM - startM;
  if (mins < 60) return `${mins}分`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours}时${rest}分` : `${hours}时`;
}

export function buildMedicationDisplayModel(
  record: MedicationRecord,
  options: { fallbackSheetEnd?: string; specialNo?: number; sheetStart?: string; sheetEnd?: string } = {},
): MedicationDisplayModel {
  const renderAsLine = shouldRenderAsLine(record);
  const renderAsPoint = shouldRenderAsPoint(record);
  const showInSpecialSection = shouldRenderInSpecialMedication(record);
  const time = medicationEventTime(record) ?? medicationStartTime(record) ?? '';
  const segmentEnd = renderAsLine ? resolveSegmentEndForLine(record, options.fallbackSheetEnd) : undefined;
  const specialNo = record.specialNo ?? options.specialNo;
  const specialNoDisplay = showInSpecialSection ? formatSpecialNo(specialNo) : '';
  const segmentWidthPercent = renderAsLine
    ? computeMedicationSegmentWidthPercent(time, segmentEnd, options.sheetStart, options.sheetEnd)
    : 0;
  const pointLabel = renderAsPoint
    ? resolveMedicationPointLabel(record, { showInSpecialSection, specialNoDisplay })
    : '';
  const { lineLabel, lineLabelMode } = renderAsLine
    ? resolveMedicationLineLabel(record, { segmentWidthPercent, showInSpecialSection, specialNoDisplay })
    : { lineLabel: '', lineLabelMode: 'hidden' as MedicationLineLabelMode };
  const resolvedSpecialNo = showInSpecialSection
    ? (typeof specialNo === 'number' ? specialNo : parseSpecialNoFromDisplay(String(specialNo ?? '')))
    : undefined;

  return {
    renderAsLine,
    renderAsPoint,
    showInSpecialSection,
    time,
    segmentEnd,
    segmentWidthPercent,
    pointLabel,
    lineLabel,
    lineLabelMode,
    markerTooltip: buildMedicationMarkerTooltip(record, {
      specialNo: resolvedSpecialNo,
      sheetStart: options.sheetStart,
      sheetEnd: options.sheetEnd,
    }),
    specialNo: resolvedSpecialNo,
    specialNoDisplay,
  };
}

function medicationSortMinutes(record: MedicationRecord): number {
  const clock = isoOrClockToClock(
    medicationStartTime(record) ?? medicationEventTime(record) ?? record.time,
  );
  return clockToMinutes(clock) ?? Number.MAX_SAFE_INTEGER;
}

/** 按给药时间严格连续分配 1…n；忽略历史 specialNo，避免序号与时间轴不一致 */
export function assignSpecialNumbers(records: MedicationRecord[]): Map<string, number> {
  const special = records
    .filter((row) => row.status !== 'voided' && shouldRenderInSpecialMedication(row))
    .sort((a, b) => medicationSortMinutes(a) - medicationSortMinutes(b));
  const map = new Map<string, number>();
  special.forEach((row, index) => {
    map.set(row.id, index + 1);
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
  const numbers = assignSpecialNumbers(records);
  const active = records
    .filter((row) => row.status !== 'voided' && shouldRenderInSpecialMedication(row))
    .sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0));
  if (!active.length) return '';
  return active
    .map((row) => formatMedicationSpecialNoteLine(row, numbers.get(row.id) ?? 1))
    .join('\n');
}

function extractDrugTokenFromNoteLine(line: string): string {
  const body = line.replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩\d]+[.、)\s]*/, '').trim();
  const withoutClock = body.replace(/^\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?\s*/, '').trim();
  return withoutClock.split(/\s+/)[0] ?? '';
}

/** 按时间顺序回写 specialNo，保证时间轴圈号与说明区序号一致 */
export function applySpecialNumbersToMedications(medications: MedicationRecord[]): void {
  const map = assignSpecialNumbers(medications);
  medications.forEach((row) => {
    if (row.status === 'voided' || !shouldRenderInSpecialMedication(row)) return;
    const no = map.get(row.id);
    if (no) row.specialNo = no;
  });
}

export function mergeSpecialMedicationNotes(manualNotes: string | undefined, records: MedicationRecord[]): string {
  const auto = buildSpecialMedicationSummaryText(records);
  const manual = manualNotes?.trim();
  if (!auto) return manual || '';
  if (!manual) return auto;
  const autoDrugs = new Set(
    records
      .filter((row) => row.status !== 'voided' && shouldRenderInSpecialMedication(row))
      .map((row) => row.drug.trim()),
  );
  const extraManual = manual
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const mentionsAutoDrug = Array.from(autoDrugs).some((drug) => drug && line.includes(drug));
      if (mentionsAutoDrug) return false;
      const token = extractDrugTokenFromNoteLine(line);
      return Boolean(token && !autoDrugs.has(token));
    });
  return extraManual.length ? `${auto}\n${extraManual.join('\n')}` : auto;
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
  if (!isSpecial) {
    patch.specialNo = undefined;
  }
  return patch;
}

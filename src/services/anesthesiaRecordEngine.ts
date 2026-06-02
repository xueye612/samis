import type { AnesthesiaPlaneRecord, FluidRecord, MedicationRecord, OutputDetailRecord, SurgeryCase, VitalSign } from '@/types/anesthesia';
import type {
  AnesthesiaRecordDocument,
  AnesthesiaRecordSnapshot,
  LabResultRecord,
  RecordPrintCheck,
  RecordSummaryFields,
  TransfusionEventRecord,
} from '@/types/anesthesiaRecord';
import type { QualityDefect } from '@/types/quality';
import type { DrugDictItem, FluidBloodDictItem, FluidBloodSubCategory, VitalSignDictItem } from '@/types/system';
import { runRecordQualityChecks } from '@/services/anesthesiaRecordHelpers';
import dayjs from 'dayjs';

export const LIVE_TIME_STEP_MINUTES = 1;
export const LIVE_DEFAULT_SEGMENT_MINUTES = 10;
export const RECORD_LOCAL_STATE_KEY = 'samis.anesthesiaRecord.localState.v1';
export const DEFAULT_SHEET_MONITOR_ORDER = ['HR', 'SBP', 'DBP', 'SpO2', 'EtCO2', 'TEMP'] as const;
const INHALED_METHOD_HINTS = ['inhalation', 'balanced', 'inhaled', '静吸复合', '吸入麻醉', '吸入诱导', '吸入维持'] as const;
const INHALED_EVENT_HINTS = ['开始吸入', '开始吸入麻醉', '调整浓度', '调整吸入浓度', '停止吸入', '停止吸入麻醉'] as const;
const INHALED_DRUG_HINTS = ['七氟烷', '地氟烷', '异氟烷', '恩氟烷', '氧化亚氮', '笑气', 'sevoflurane', 'desflurane', 'isoflurane', 'nitrous oxide'] as const;
const AUTOLOGOUS_HINTS = ['自体血', '自体血回输', '回收血', '术中回收血', '洗涤回收血'] as const;

function hasTextHint(text: string | undefined, hints: readonly string[]) {
  if (!text) return false;
  const source = text.toLowerCase();
  return hints.some((hint) => source.includes(hint.toLowerCase()));
}

export interface LiveTick {
  time: string;
  label: string;
  percent: number;
  isMajor: boolean;
}

export interface LiveTimeScale {
  start: string;
  end: string;
  totalMinutes: number;
  minorInterval: number;
  majorInterval: number;
  minorTicks: LiveTick[];
  majorTicks: LiveTick[];
}

export interface AbnormalVitalByDictionary {
  id: string;
  rowId?: string;
  time: string;
  metric: string;
  label: string;
  value: number;
  low?: number;
  high?: number;
  unit: string;
  suggestion: string;
  handled: boolean;
}

export interface LiveRecordQualityCheck {
  item: string;
  status: '通过' | '警告' | '未通过';
  message: string;
  target: string;
}

export interface RecordGridLine {
  id: string;
  percent: number;
  isMajor: boolean;
}

export interface RecordBandGrid {
  verticalLines: RecordGridLine[];
  rowLines: RecordGridLine[];
}

export interface RecordLineDraft {
  kind: 'medication' | 'infusion' | 'transfusion';
  id?: string;
  name: string;
  mode?: MedicationRecord['mode'];
  category?: FluidRecord['category'];
  time: string;
  endTime?: string;
  amount?: number;
  unit?: string;
  route?: string;
  executor?: string;
  checker?: string;
  highAlert?: boolean;
  isSpecial?: boolean;
  specialNo?: number;
  reason?: string;
  bloodType?: string;
  rh?: string;
  reaction?: string;
  bagNo?: string;
  anesthesiaConfirm?: string;
  circulatingConfirm?: string;
  requiresDoubleCheck?: boolean;
  doubleCheck?: boolean;
  remark?: string;
}

export interface VitalMarkerShape {
  shape: NonNullable<VitalSignDictItem['chartSymbol']>;
  text: string;
  stroke: boolean;
  fill: boolean;
}

export interface BloodProductIntakeLine {
  label: string;
  volume: number;
  unit: string;
  display: string;
}

export interface BalanceSummary {
  /** 晶体 + 胶体 + 自体血（ml），不含血制品。 */
  totalInput: number;
  totalOutput: number;
  urine: number;
  bloodLoss: number;
  drainage: number;
  otherOutput: number;
  crystalInput: number;
  colloidInput: number;
  /** 血制品按单位汇总后的展示行（红细胞 U、血浆 ml、血小板 治疗量、冷沉淀 U 等）。 */
  bloodProductLines: BloodProductIntakeLine[];
  bloodProductText: string;
  /** @deprecated 仅保留数字合计，请用 bloodProductText；勿与 ml 总量混加。 */
  bloodInput: number;
  autologousInput: number;
}

const BLOOD_PRODUCT_LABEL_ORDER = ['红细胞', '血浆', '血小板', '冷沉淀'] as const;

const BLOOD_PRODUCT_SHORT_LABELS: Record<string, string> = {
  悬浮红细胞: '红细胞',
  红细胞: '红细胞',
  新鲜冰冻血浆: '血浆',
  血浆: '血浆',
  血小板: '血小板',
  冷沉淀: '冷沉淀',
};

export function formatFluidIntakeAmount(volume: number, unit = 'ml') {
  const value = Number(volume) || 0;
  if (!value) return '';
  if (unit === 'ml') return `${value}ml`;
  if (unit === '治疗量') return `${value}治疗量`;
  return `${value}${unit}`;
}

export function buildBloodProductIntakeSummary(fluids: FluidRecord[] = []): { lines: BloodProductIntakeLine[]; text: string } {
  const buckets = new Map<string, BloodProductIntakeLine>();
  fluids
    .filter((row) => row.category === '血液制品' && row.status !== 'voided')
    .forEach((row) => {
      const unit = row.unit ?? 'U';
      const label = BLOOD_PRODUCT_SHORT_LABELS[row.name] ?? row.name;
      const key = `${label}::${unit}`;
      const volume = Number(row.volume) || 0;
      const existing = buckets.get(key);
      if (existing) {
        existing.volume += volume;
        existing.display = `${label} ${formatFluidIntakeAmount(existing.volume, existing.unit)}`.trim();
        existing.label = label;
        return;
      }
      buckets.set(key, {
        label,
        volume,
        unit,
        display: `${label} ${formatFluidIntakeAmount(volume, unit)}`.trim(),
      });
    });

  const lines = [...buckets.values()].sort((a, b) => {
    const ai = BLOOD_PRODUCT_LABEL_ORDER.indexOf(a.label as typeof BLOOD_PRODUCT_LABEL_ORDER[number]);
    const bi = BLOOD_PRODUCT_LABEL_ORDER.indexOf(b.label as typeof BLOOD_PRODUCT_LABEL_ORDER[number]);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.label.localeCompare(b.label, 'zh-Hans-CN');
  });
  const text = lines.map((line) => line.display).filter(Boolean).join('  ');
  return { lines, text };
}

export interface MonitorCell {
  key: string;
  row: VitalSign;
  metric: string;
  value: string | number;
  time: string;
  rowIndex: number;
  rowCount: number;
  leftPercent: number;
  topPercent: number;
  abnormal: boolean;
  unit: string;
}

export interface RecordLocalState {
  configDrugs?: DrugDictItem[];
  configVitals?: VitalSignDictItem[];
  configFluids?: FluidBloodDictItem[];
  genericDicts?: Record<string, string[]>;
  drafts?: Record<string, unknown>;
}

export type AnesthesiaPlaneDraft = Omit<AnesthesiaPlaneRecord, 'id'> & { id?: string };

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem?(key: string): unknown;
}

export function parseNormalRange(range?: string): Pick<VitalSignDictItem, 'lowerLimit' | 'upperLimit'> {
  if (!range) return {};
  const normalized = range.replace(/[^\d.\-~～]/g, '').replace('～', '-').replace('~', '-');
  const [low, high] = normalized.split('-').map((item) => Number(item));
  return {
    lowerLimit: Number.isFinite(low) ? low : undefined,
    upperLimit: Number.isFinite(high) ? high : undefined,
  };
}

export function buildDrugCatalog(items: DrugDictItem[]) {
  return [...items]
    .filter((item) => item.enabled)
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

export function buildVitalCatalog(items: VitalSignDictItem[]) {
  return [...items]
    .filter((item) => item.enabled)
    .map((item) => ({ ...parseNormalRange(item.normalRange), ...item }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** 解析字典名称「心率 HR」为弹窗展示用的中文名与英文缩写。 */
export function formatVitalMonitorLabel(item: Pick<VitalSignDictItem, 'name' | 'shortCode' | 'unit'>) {
  const raw = item.name?.trim() || '';
  const split = raw.match(/^(.+?)\s+([A-Za-z][A-Za-z0-9]*)$/);
  if (split) {
    return { labelZh: split[1], labelCode: split[2], unit: item.unit };
  }
  return { labelZh: raw || item.shortCode, labelCode: item.shortCode, unit: item.unit };
}

export function resolveDefaultMonitorOrder(items: VitalSignDictItem[]) {
  const enabled = items.filter((item) => item.enabled);
  const enabledCodes = new Set(enabled.map((item) => item.shortCode));
  const preferred = DEFAULT_SHEET_MONITOR_ORDER.filter((code) => enabledCodes.has(code));
  if (preferred.length >= 4) return [...preferred];
  return enabled.slice(0, 8).map((item) => item.shortCode);
}

export function isInhaledMedication(
  record: Pick<MedicationRecord, 'route' | 'drug' | 'name'>,
  drugs: DrugDictItem[] = [],
) {
  if (record.route?.includes('吸入')) return true;
  const drugName = record.drug || record.name;
  if (hasTextHint(drugName, INHALED_DRUG_HINTS)) return true;
  const dict = drugs.find((item) => item.name === drugName);
  return Boolean(dict?.defaultRoute?.includes('吸入') || hasTextHint(dict?.name, INHALED_DRUG_HINTS));
}

export function hasInhaledMethodHint(labels: Array<string | undefined> = []) {
  return labels.some((label) => hasTextHint(label, INHALED_METHOD_HINTS));
}

export function hasInhaledEventHint(eventTypes: Array<string | undefined> = []) {
  return eventTypes.some((eventType) => hasTextHint(eventType, INHALED_EVENT_HINTS));
}

export function isAutologousFluidCategory(category?: string, name?: string) {
  return hasTextHint(category, AUTOLOGOUS_HINTS) || hasTextHint(name, AUTOLOGOUS_HINTS);
}

export function isBloodProductCategory(category: FluidRecord['category']) {
  return category === '血液制品';
}

export function isInfusionFluidCategory(category: FluidRecord['category']) {
  return category === '晶体液' || category === '胶体液';
}

export function buildFluidCatalog(items: FluidBloodDictItem[], subCategory?: FluidBloodSubCategory) {
  return [...items]
    .filter((item) => item.enabled && (!subCategory || item.subCategory === subCategory))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

export function normalizeMedicationFromDrug(drug: DrugDictItem, executor = ''): Omit<MedicationRecord, 'id'> {
  const mode = drug.defaultMode ?? '单次用药';
  const isSpecial = Boolean(drug.defaultIsSpecial);
  return {
    mode,
    drugId: drug.id,
    drug: drug.name,
    name: drug.name,
    dose: typeof drug.defaultDose === 'number' ? drug.defaultDose : Number(drug.defaultDose) || undefined,
    unit: drug.doseUnit,
    route: drug.defaultRoute,
    executor,
    highAlert: Boolean(drug.highAlert),
    isSpecial,
    specialCategory: isSpecial ? drug.specialCategory : undefined,
    specialReason: isSpecial ? drug.specialReasonTemplate : undefined,
    reason: isSpecial ? drug.specialReasonTemplate : (mode === '持续泵入' ? '持续用药' : '术中给药'),
  };
}

export function normalizeFluidFromDict(fluid: FluidBloodDictItem, executor = ''): Omit<FluidRecord, 'id'> {
  const isBlood = fluid.subCategory === '血液制品';
  return {
    category: fluid.subCategory,
    name: fluid.name,
    product: isBlood ? fluid.name : undefined,
    startTime: new Date().toISOString(),
    volume: fluid.defaultVolume ?? (isBlood ? 1 : 500),
    unit: fluid.defaultUnit ?? (isBlood ? 'U' : 'ml'),
    executor,
    reaction: isBlood ? '无' : undefined,
    doubleCheck: !fluid.requiresDoubleCheck,
  };
}

export function createMedicationLineDraft(
  drug: DrugDictItem,
  options: { at?: string; executor?: string; id?: string } = {},
): RecordLineDraft {
  const normalized = normalizeMedicationFromDrug(drug, options.executor);
  const time = options.at ?? resolveRecordSheetNowClock();
  return {
    kind: 'medication',
    id: options.id,
    name: normalized.drug,
    mode: normalized.mode,
    time,
    endTime: normalized.mode === '持续泵入' ? addMinutesToClock(time, LIVE_DEFAULT_SEGMENT_MINUTES) : undefined,
    amount: normalized.dose,
    unit: normalized.unit,
    route: normalized.route,
    executor: normalized.executor,
    highAlert: normalized.highAlert,
    isSpecial: normalized.isSpecial,
    specialCategory: normalized.specialCategory,
    specialReason: normalized.specialReason,
    reason: normalized.reason,
    pumpRate: normalized.pumpRate,
  };
}

export function createFluidLineDraft(
  fluid: FluidBloodDictItem,
  options: { at?: string; executor?: string; id?: string; bloodType?: string; rh?: string } = {},
): RecordLineDraft {
  const normalized = normalizeFluidFromDict(fluid, options.executor);
  const time = options.at ?? resolveRecordSheetNowClock();
  const isBlood = fluid.subCategory === '血液制品';
  const isAutologous = isAutologousFluidCategory(fluid.subCategory, fluid.name);
  return {
    kind: isBlood ? 'transfusion' : 'infusion',
    id: options.id,
    name: normalized.name,
    category: isAutologous ? '自体血回输' : normalized.category,
    time,
    endTime: addMinutesToClock(time, LIVE_DEFAULT_SEGMENT_MINUTES),
    amount: normalized.volume,
    unit: normalized.unit,
    executor: normalized.executor,
    bloodType: isBlood ? options.bloodType : undefined,
    rh: isBlood ? options.rh : undefined,
    reaction: normalized.reaction,
    requiresDoubleCheck: Boolean(fluid.requiresDoubleCheck),
    doubleCheck: Boolean(normalized.doubleCheck),
  };
}

function hasNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function detectDictionaryDrivenAbnormalVitals(vitals: VitalSign[], dict: VitalSignDictItem[]): AbnormalVitalByDictionary[] {
  const catalog = buildVitalCatalog(dict);
  return vitals.flatMap((row) =>
    catalog.flatMap((item) => {
      const key = item.shortCode as keyof VitalSign;
      const value = row[key];
      if (!hasNumber(value)) return [];
      const low = item.lowerLimit;
      const high = item.upperLimit;
      const tooLow = typeof low === 'number' && value < low;
      const tooHigh = typeof high === 'number' && value > high;
      if (!tooLow && !tooHigh) return [];
      return [{
        id: `${row.id ?? row.time}-${item.shortCode}`,
        rowId: row.id,
        time: row.time,
        metric: item.shortCode,
        label: item.name,
        value,
        low,
        high,
        unit: item.unit,
        suggestion: `${item.name}超出参考范围，需记录复测、处置和持续观察。`,
        handled: Boolean(row.abnormalHandled?.[item.shortCode]),
      }];
    }),
  );
}

export interface AggregatedAbnormalVital {
  id: string;
  metric: string;
  label: string;
  unit: string;
  consecutiveCount: number;
  latestValue: number;
  latestTime: string;
  severity: 'mild' | 'severe';
  handled: boolean;
  summary: string;
  low?: number;
  high?: number;
}

export function vitalSourcePriority(source?: string, corrected?: boolean): number {
  if (corrected) return 100;
  if (source === '手工修正' || source?.includes('修正')) return 100;
  if (source === '手工录入' || source?.includes('手工')) return 90;
  if (source?.includes('设备')) return 10;
  return 50;
}

/** 趋势图/监护带：按显示间隔分桶，每桶保留优先级最高的一条 vital_signs。 */
export function selectDisplayVitalsForBand(
  vitals: VitalSign[],
  gridMinutes = 5,
): VitalSign[] {
  const active = vitals.filter((row) => row.status !== 'voided');
  const buckets = new Map<number, VitalSign>();
  active.forEach((row) => {
    const clock = isoOrClockToClock(row.time);
    const mins = timeToFractionalMinutes(clock);
    if (mins === null) return;
    const bucket = Math.floor(mins / Math.max(1, gridMinutes));
    const existing = buckets.get(bucket);
    const rowPriority = vitalSourcePriority(row.source, Boolean(row.correctedValue));
    if (!existing) {
      buckets.set(bucket, row);
      return;
    }
    const existingPriority = vitalSourcePriority(existing.source, Boolean(existing.correctedValue));
    if (rowPriority > existingPriority || (rowPriority === existingPriority && String(row.time).localeCompare(String(existing.time)) > 0)) {
      buckets.set(bucket, row);
    }
  });
  return [...buckets.values()].sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

/** 右侧面板：合并同类异常，轻度单点不进面板，连续/严重才提醒。 */
export function aggregateAbnormalVitalsForPanel(
  vitals: VitalSign[],
  dict: VitalSignDictItem[],
  options?: { consecutiveThreshold?: number; maxItems?: number },
): AggregatedAbnormalVital[] {
  const threshold = options?.consecutiveThreshold ?? 3;
  const maxItems = options?.maxItems ?? 3;
  const raw = detectDictionaryDrivenAbnormalVitals(vitals, dict).filter((item) => !item.handled);
  const byMetric = new Map<string, AbnormalVitalByDictionary[]>();
  raw.forEach((item) => {
    const list = byMetric.get(item.metric) ?? [];
    list.push(item);
    byMetric.set(item.metric, list);
  });

  const results: AggregatedAbnormalVital[] = [];
  byMetric.forEach((items, metric) => {
    const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
    let maxRun = 1;
    let currentRun = 1;
    for (let index = 1; index < sorted.length; index += 1) {
      const gap = Math.abs(dayjs(sorted[index].time).diff(sorted[index - 1].time, 'minute'));
      if (gap <= 10) {
        currentRun += 1;
        maxRun = Math.max(maxRun, currentRun);
      } else {
        currentRun = 1;
      }
    }
    const latest = sorted[sorted.length - 1];
    const tooHigh = typeof latest.high === 'number' && latest.value > latest.high;
    const tooLow = typeof latest.low === 'number' && latest.value < latest.low;
    const deviation = tooHigh && typeof latest.high === 'number'
      ? (latest.value - latest.high) / latest.high
      : tooLow && typeof latest.low === 'number'
        ? (latest.low - latest.value) / latest.low
        : 0;
    const severe = deviation >= 0.15 || maxRun >= threshold;
    if (!severe && maxRun < threshold) return;

    const direction = tooHigh ? '偏高' : '偏低';
    results.push({
      id: `${metric}-${latest.time}`,
      metric,
      label: latest.label,
      unit: latest.unit,
      consecutiveCount: maxRun,
      latestValue: latest.value,
      latestTime: latest.time,
      severity: severe ? 'severe' : 'mild',
      handled: false,
      low: latest.low,
      high: latest.high,
      summary: maxRun >= 2 ? `${latest.metric} ${direction}，连续 ${maxRun} 次` : `${latest.metric} ${direction}`,
    });
  });

  return results
    .sort((a, b) => Number(b.severity === 'severe') - Number(a.severity === 'severe') || b.consecutiveCount - a.consecutiveCount)
    .slice(0, maxItems);
}

export function clockToMinutes(time?: string) {
  if (!time) return null;
  const parts = time.split(':').map(Number);
  const [hour, minute] = parts;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

/** 含秒/毫秒的小数分钟，用于趋势图与设备高频点位横轴定位。 */
export function timeToFractionalMinutes(time?: string): number | null {
  if (!time) return null;
  if (/^\d{2}:\d{2}$/.test(time)) {
    const [hour, minute] = time.split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    const [hour, minute, second] = time.split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null;
    return hour * 60 + minute + second / 60;
  }
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60 + date.getMilliseconds() / 60000;
}

export function snapMonitorBandLeftPercent(
  leftPercent: number,
  start = '08:00',
  end = '11:30',
  gridMinutes = 5,
): number {
  const startMinutes = clockToMinutes(start);
  const endMinutes = clockToMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return leftPercent;
  const range = endMinutes - startMinutes;
  const absolute = startMinutes + (leftPercent / 100) * range;
  const snapped = Math.round(absolute / Math.max(1, gridMinutes)) * Math.max(1, gridMinutes);
  const clamped = Math.max(startMinutes, Math.min(endMinutes, snapped));
  return Number((((clamped - startMinutes) / range) * 100).toFixed(6));
}

export function dedupeVitalsById(vitals: VitalSign[] = []): VitalSign[] {
  const map = new Map<string, VitalSign>();
  vitals.forEach((row, index) => {
    const key = row.id ?? `${row.time}-${row.source ?? 'unknown'}-${index}`;
    map.set(key, row);
  });
  return [...map.values()].sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

export function minutesToClock(totalMinutes: number) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function addMinutesToClock(clock: string, minutes: number) {
  return minutesToClock((clockToMinutes(clock) ?? 0) + minutes);
}

/** 记录单录入弹窗默认时刻：手术日锚定下的当前时分。 */
export function resolveRecordSheetNowClock(
  record?: Pick<SurgeryCase, 'plannedStart' | 'anesthesiaStart'>,
): string {
  const now = new Date();
  const base = record?.plannedStart || record?.anesthesiaStart;
  if (base) {
    const anchor = new Date(base);
    if (!Number.isNaN(anchor.getTime())) {
      anchor.setHours(now.getHours(), now.getMinutes(), 0, 0);
      return isoOrClockToClock(anchor.toISOString());
    }
  }
  return isoOrClockToClock(now.toISOString());
}

/** 设备/录入用：锚定手术日期的当前时刻 ISO（保留秒）。 */
export function resolveRecordSheetNowIso(
  record?: Pick<SurgeryCase, 'plannedStart' | 'anesthesiaStart' | 'roomInTime' | 'actualStart'>,
): string {
  const now = new Date();
  const base = record?.anesthesiaStart || record?.plannedStart;
  if (base) {
    const anchor = new Date(base);
    if (!Number.isNaN(anchor.getTime())) {
      anchor.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      if (record) {
        const axisStartClock = isoOrClockToClock(
          record.roomInTime ?? record.anesthesiaStart ?? record.actualStart ?? record.plannedStart,
        ) || '08:00';
        const axisStartMinutes = clockToMinutes(axisStartClock);
        const anchorMinutes = anchor.getHours() * 60 + anchor.getMinutes() + anchor.getSeconds() / 60;
        if (axisStartMinutes !== null && anchorMinutes < axisStartMinutes) {
          const hour = Math.floor(axisStartMinutes / 60);
          const minute = Math.floor(axisStartMinutes % 60);
          anchor.setHours(hour, minute, now.getSeconds(), now.getMilliseconds());
        }
      }
      return anchor.toISOString();
    }
  }
  return now.toISOString();
}

export function isoOrClockToClock(value?: string) {
  if (!value) return '';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function calculateLiveSheetEnd(start = '08:00', times: Array<string | undefined> = [], minimumMinutes = 210, roundMinutes = 30) {
  const startMinutes = clockToMinutes(start) ?? 0;
  const values = times
    .map(isoOrClockToClock)
    .map((time) => clockToMinutes(time))
    .filter((value): value is number => value !== null);
  const latest = Math.max(startMinutes + minimumMinutes, ...values);
  const step = Math.max(1, roundMinutes);
  return minutesToClock(startMinutes + Math.ceil((latest - startMinutes) / step) * step);
}

export function buildLiveTimeScale(start = '08:00', end = '11:30', minorInterval = 5, majorInterval = 30): LiveTimeScale {
  const startMinutes = clockToMinutes(start) ?? 0;
  const rawEnd = clockToMinutes(end) ?? startMinutes + 210;
  const endMinutes = rawEnd > startMinutes ? rawEnd : startMinutes + 210;
  const totalMinutes = endMinutes - startMinutes;
  const buildTicks = (interval: number) => {
    const ticks: LiveTick[] = [];
    for (let minute = startMinutes; minute <= endMinutes; minute += interval) {
      const offset = minute - startMinutes;
      ticks.push({
        time: minutesToClock(minute),
        label: minutesToClock(minute),
        percent: Number(((offset / totalMinutes) * 100).toFixed(6)),
        isMajor: offset % majorInterval === 0,
      });
    }
    return ticks;
  };
  return {
    start: minutesToClock(startMinutes),
    end: minutesToClock(endMinutes),
    totalMinutes,
    minorInterval,
    majorInterval,
    minorTicks: buildTicks(minorInterval),
    majorTicks: buildTicks(majorInterval),
  };
}

export function buildRecordBandGrid(scale: LiveTimeScale, rowCount: number): RecordBandGrid {
  const rows = Math.max(1, Math.floor(rowCount));
  return {
    verticalLines: scale.minorTicks.slice(1, -1).map((tick) => ({
      id: tick.time,
      percent: tick.percent,
      isMajor: tick.isMajor,
    })),
    rowLines: Array.from({ length: Math.max(0, rows - 1) }, (_, index) => ({
      id: `row-${index + 1}`,
      percent: Number((((index + 1) / rows) * 100).toFixed(6)),
      isMajor: false,
    })),
  };
}

export function chartYWithPadding(
  value: number,
  options: { min?: number; max?: number; height?: number; padding?: number } = {},
) {
  const min = options.min ?? 40;
  const max = options.max ?? 200;
  const height = options.height ?? 300;
  const padding = Math.max(0, Math.min(height / 2, options.padding ?? 18));
  const safeRange = Math.max(1, max - min);
  const normalized = Math.max(0, Math.min(1, (value - min) / safeRange));
  return Number((height - padding - normalized * (height - padding * 2)).toFixed(3));
}

export const CHART_VIEW_HEIGHT = 300;
export const CHART_VIEW_PADDING = 18;

export const PRESSURE_CHART_SCALE = { min: 20, max: 220, height: CHART_VIEW_HEIGHT, padding: CHART_VIEW_PADDING } as const;
export const TEMP_CHART_SCALE = { min: 33, max: 39, height: CHART_VIEW_HEIGHT, padding: CHART_VIEW_PADDING } as const;
export const RR_CHART_SCALE = { min: 2, max: 26, height: CHART_VIEW_HEIGHT, padding: CHART_VIEW_PADDING } as const;

export function chartYPercent(value: number, scale: { min: number; max: number; height?: number; padding?: number }) {
  const height = scale.height ?? CHART_VIEW_HEIGHT;
  return Number(((chartYWithPadding(value, scale) / height) * 100).toFixed(4));
}

export function resolveChartY(value: number, shortCode?: string) {
  if (shortCode === 'RR') return chartYWithPadding(value, RR_CHART_SCALE);
  if (shortCode === 'TEMP') return chartYWithPadding(value, TEMP_CHART_SCALE);
  return chartYWithPadding(value, PRESSURE_CHART_SCALE);
}

export function buildTempScaleTicks(values: number[] = [39, 37, 35, 33]) {
  return values.map((value) => ({ value, top: chartYPercent(value, TEMP_CHART_SCALE) }));
}

export function shouldDrawChartPolyline(shortCode: string) {
  return shortCode !== 'TEMP';
}

export function monitorCellTopPercent(index: number, total: number, insetRatio = 0.5) {
  const rows = Math.max(1, total);
  const safeIndex = Math.max(0, Math.min(rows - 1, index));
  const rowHeight = 100 / rows;
  return Number((safeIndex * rowHeight + rowHeight * Math.max(0.1, Math.min(0.55, insetRatio))).toFixed(6));
}

export function buildMonitorCells(
  rows: VitalSign[],
  items: VitalSignDictItem[],
  selectedOrder: string[] = [],
  timeline: { start?: string; end?: string; cellOffsetPercent?: number; gridMinutes?: number } = {},
): MonitorCell[] {
  const order = selectedOrder.length ? selectedOrder : items.map((item) => item.shortCode);
  const orderedItems = order
    .map((code) => items.find((item) => item.shortCode === code))
    .filter((item): item is VitalSignDictItem => Boolean(item));
  const rowCount = Math.max(1, orderedItems.length);
  const gridMinutes = timeline.gridMinutes ?? 5;

  const cells = [...rows]
    .sort((a, b) => String(a.time).localeCompare(String(b.time)))
    .flatMap((row) =>
      orderedItems.flatMap((item, rowIndex) => {
        const value = row[item.shortCode as keyof VitalSign];
        if (value === undefined || value === null || value === '') return [];
        const numeric = typeof value === 'number' ? value : Number(value);
        const abnormal =
          Number.isFinite(numeric) &&
          ((typeof item.lowerLimit === 'number' && numeric < item.lowerLimit) ||
            (typeof item.upperLimit === 'number' && numeric > item.upperLimit));
        const rawLeft = timeToPercent(row.time, timeline.start, timeline.end) + (timeline.cellOffsetPercent ?? 0);
        const leftPercent = snapMonitorBandLeftPercent(
          rawLeft,
          timeline.start,
          timeline.end,
          gridMinutes,
        );
        return [{
          key: `${row.id ?? row.time}-${item.shortCode}`,
          row,
          metric: item.shortCode,
          value: value as string | number,
          time: row.time,
          rowIndex,
          rowCount,
          leftPercent: Number(Math.max(0, Math.min(100, leftPercent)).toFixed(6)),
          topPercent: monitorCellTopPercent(rowIndex, rowCount),
          abnormal,
          unit: item.unit,
        }];
      }),
    );

  const deduped = new Map<string, MonitorCell>();
  cells.forEach((cell) => {
    const bucketKey = `${cell.metric}-${cell.leftPercent.toFixed(4)}`;
    const existing = deduped.get(bucketKey);
    if (!existing || String(cell.time).localeCompare(String(existing.time)) > 0) {
      deduped.set(bucketKey, cell);
    }
  });
  return [...deduped.values()].sort((a, b) => a.leftPercent - b.leftPercent || a.rowIndex - b.rowIndex);
}

export function moveMonitorItemOrder(order: string[], code: string, mode: 'up' | 'down' | 'to-index', targetIndex?: number) {
  const list = [...order];
  const index = list.indexOf(code);
  if (index < 0) return list;
  const nextIndex = mode === 'up'
    ? index - 1
    : mode === 'down'
      ? index + 1
      : Number(targetIndex);
  const boundedIndex = Math.max(0, Math.min(list.length - 1, Number.isFinite(nextIndex) ? nextIndex : index));
  if (boundedIndex === index) return list;
  const [item] = list.splice(index, 1);
  list.splice(boundedIndex, 0, item);
  return list;
}

export function clampVitalValueByDict(value: number, item: Pick<VitalSignDictItem, 'lowerLimit' | 'upperLimit' | 'decimalPlaces'>) {
  const decimalPlaces = Math.max(0, item.decimalPlaces ?? 0);
  const factor = 10 ** decimalPlaces;
  const rounded = Math.round((Number(value) || 0) * factor) / factor;
  const low = typeof item.lowerLimit === 'number' ? item.lowerLimit : -Infinity;
  const high = typeof item.upperLimit === 'number' ? item.upperLimit : Infinity;
  return Math.max(low, Math.min(high, rounded));
}

export function dragVitalPointValue(
  y: number,
  item: Pick<VitalSignDictItem, 'lowerLimit' | 'upperLimit' | 'decimalPlaces'>,
  options: { min?: number; max?: number; height?: number; padding?: number } = {},
) {
  const min = options.min ?? 40;
  const max = options.max ?? 200;
  const height = options.height ?? 300;
  const padding = Math.max(0, Math.min(height / 2, options.padding ?? 18));
  const drawable = Math.max(1, height - padding * 2);
  const normalized = Math.max(0, Math.min(1, (height - padding - y) / drawable));
  const raw = min + normalized * (max - min);
  return clampVitalValueByDict(raw, item);
}

export function createAnesthesiaPlaneDraft(
  plane?: Partial<AnesthesiaPlaneRecord>,
  options: { at?: string; level?: string; direction?: AnesthesiaPlaneRecord['direction'] } = {},
): AnesthesiaPlaneDraft {
  return {
    id: plane?.id,
    time: isoOrClockToClock(plane?.time) || options.at || isoOrClockToClock(new Date().toISOString()),
    level: plane?.level || options.level || 'T6',
    direction: plane?.direction || options.direction || 'down',
    remark: plane?.remark,
  };
}

export function findVitalUpsertIndex(rows: VitalSign[], next: Pick<VitalSign, 'id' | 'time'>) {
  if (next.id) {
    const byId = rows.findIndex((row) => row.id === next.id);
    if (byId >= 0) return byId;
  }
  const nextTime = isoOrClockToClock(next.time);
  if (!nextTime) return -1;
  return rows.findIndex((row) => isoOrClockToClock(row.time) === nextTime);
}

export function vitalMarkerShape(item: Pick<VitalSignDictItem, 'shortCode' | 'chartSymbol'>): VitalMarkerShape {
  const symbol = item.chartSymbol ?? (
    item.shortCode === 'SBP' ? 'triangle-down'
      : item.shortCode === 'DBP' ? 'triangle-up'
        : item.shortCode === 'HR' ? 'circle'
          : item.shortCode === 'TEMP' ? 'square'
            : item.shortCode === 'RR' ? 'hollow-circle'
              : 'text'
  );
  const textBySymbol: Record<NonNullable<VitalSignDictItem['chartSymbol']>, string> = {
    'triangle-down': '▽',
    'triangle-up': '△',
    circle: '●',
    'hollow-circle': '○',
    diamond: '◇',
    star: '★',
    square: '■',
    text: '•',
  };
  return {
    shape: symbol,
    text: textBySymbol[symbol],
    stroke: ['triangle-down', 'triangle-up', 'hollow-circle', 'diamond'].includes(symbol),
    fill: !['triangle-down', 'triangle-up', 'hollow-circle', 'diamond'].includes(symbol),
  };
}

export function buildBalanceSummary(item: Pick<SurgeryCase, 'fluids' | 'outputs' | 'outputRecords'>): BalanceSummary {
  const inputByCategory = (category: FluidRecord['category']) =>
    item.fluids
      .filter((row) => row.category === category && row.status !== 'voided')
      .reduce((sum, row) => sum + (Number(row.volume) || 0), 0);
  const outputDetails = (item.outputRecords ?? []).filter((row) => row.status !== 'voided');
  const outputByType = (type: OutputDetailRecord['type']) =>
    outputDetails.filter((row) => row.type === type).reduce((sum, row) => sum + (Number(row.volume) || 0), 0);
  const urine = outputDetails.length ? outputByType('尿量') : item.outputs.urine || 0;
  const bloodLoss = outputDetails.length ? outputByType('出血量') : item.outputs.bloodLoss || 0;
  const drainage = outputDetails.length ? outputByType('引流量') : item.outputs.drainage || 0;
  const otherOutput = outputByType('其他');
  const crystalInput = inputByCategory('晶体液');
  const colloidInput = inputByCategory('胶体液');
  const autologousInput = inputByCategory('自体血回输');
  const { lines: bloodProductLines, text: bloodProductText } = buildBloodProductIntakeSummary(item.fluids);
  const bloodInput = bloodProductLines.reduce((sum, line) => sum + line.volume, 0);
  return {
    crystalInput,
    colloidInput,
    bloodProductLines,
    bloodProductText,
    bloodInput,
    autologousInput,
    totalInput: crystalInput + colloidInput + autologousInput,
    urine,
    bloodLoss,
    drainage,
    otherOutput,
    totalOutput: urine + bloodLoss + drainage + otherOutput,
  };
}

export function timeToPercent(time?: string, start = '08:00', end = '11:30') {
  const startMinutes = clockToMinutes(start);
  const endMinutes = clockToMinutes(end);
  const valueMinutes = timeToFractionalMinutes(time);
  if (startMinutes === null || endMinutes === null || valueMinutes === null || endMinutes <= startMinutes) return 0;
  return Number(Math.max(0, Math.min(100, ((valueMinutes - startMinutes) / (endMinutes - startMinutes)) * 100)).toFixed(6));
}

export function percentToTime(percent: number, start = '08:00', end = '11:30', snapMinutes = LIVE_TIME_STEP_MINUTES) {
  const startMinutes = clockToMinutes(start) ?? 0;
  const endMinutes = clockToMinutes(end) ?? startMinutes + 210;
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const raw = startMinutes + (safePercent / 100) * (endMinutes - startMinutes);
  const snap = Math.max(1, snapMinutes);
  return minutesToClock(Math.round(raw / snap) * snap);
}

export function dragTimeSegment(
  segment: { start?: string; end?: string },
  options: { mode: 'move' | 'start' | 'end'; deltaPercent?: number; targetPercent?: number; sheetStart?: string; sheetEnd?: string; snapMinutes?: number; minDuration?: number },
) {
  const sheetStart = options.sheetStart ?? '08:00';
  const sheetEnd = options.sheetEnd ?? '11:30';
  const start = clockToMinutes(isoOrClockToClock(segment.start)) ?? clockToMinutes(sheetStart) ?? 0;
  const end = clockToMinutes(isoOrClockToClock(segment.end)) ?? start + LIVE_DEFAULT_SEGMENT_MINUTES;
  const rangeStart = clockToMinutes(sheetStart) ?? 0;
  const rangeEnd = clockToMinutes(sheetEnd) ?? rangeStart + 210;
  const range = Math.max(1, rangeEnd - rangeStart);
  const snap = Math.max(1, options.snapMinutes ?? LIVE_TIME_STEP_MINUTES);
  const minDuration = Math.max(snap, options.minDuration ?? snap);
  const snapMinute = (value: number) => Math.round(value / snap) * snap;
  let nextStart = start;
  let nextEnd = Math.max(end, start + minDuration);

  if (options.mode === 'move') {
    const delta = snapMinute(((options.deltaPercent ?? 0) / 100) * range);
    const duration = nextEnd - nextStart;
    nextStart = Math.max(rangeStart, Math.min(rangeEnd - duration, nextStart + delta));
    nextEnd = nextStart + duration;
  }
  if (options.mode === 'start') {
    nextStart = clockToMinutes(percentToTime(options.targetPercent ?? 0, sheetStart, sheetEnd, snap)) ?? nextStart;
    nextStart = Math.max(rangeStart, Math.min(nextStart, nextEnd - minDuration));
  }
  if (options.mode === 'end') {
    nextEnd = clockToMinutes(percentToTime(options.targetPercent ?? 0, sheetStart, sheetEnd, snap)) ?? nextEnd;
    nextEnd = Math.min(rangeEnd, Math.max(nextEnd, nextStart + minDuration));
  }

  return { start: minutesToClock(snapMinute(nextStart)), end: minutesToClock(snapMinute(nextEnd)) };
}

function check(status: LiveRecordQualityCheck['status'], item: string, message: string, target: string): LiveRecordQualityCheck {
  return { status, item, message, target };
}

export function runLiveRecordQualityChecks(
  item: SurgeryCase,
  dictionaries: { drugs: DrugDictItem[]; vitals: VitalSignDictItem[]; fluids: FluidBloodDictItem[] },
): LiveRecordQualityCheck[] {
  const drugMap = new Map(dictionaries.drugs.map((drug) => [drug.name, drug]));
  const fluidMap = new Map(dictionaries.fluids.map((fluid) => [fluid.name, fluid]));
  const abnormal = detectDictionaryDrivenAbnormalVitals(item.vitals, dictionaries.vitals);
  const highAlertMissing = item.medications.filter((med) => (med.highAlert || drugMap.get(med.drug)?.highAlert) && !med.checker);
  const transfusionMissing = item.fluids.filter((fluid) => {
    const dict = fluidMap.get(fluid.name);
    return (fluid.category === '血液制品' || dict?.requiresDoubleCheck) && !fluid.doubleCheck;
  });
  const timelineBroken = Boolean(item.anesthesiaStart && item.surgeryStart && new Date(item.surgeryStart).getTime() < new Date(item.anesthesiaStart).getTime());
  const unhandled = abnormal.filter((row) => !row.handled);

  return [
    item.patientName && item.surgeryName
      ? check('通过', '患者手术信息', '患者身份、诊断和手术信息完整', 'patient')
      : check('未通过', '患者手术信息', '缺少患者或手术信息', 'patient'),
    timelineBroken
      ? check('未通过', '关键时间顺序', '手术开始时间不能早于麻醉开始时间', 'timeline')
      : check('通过', '关键时间顺序', '关键时间顺序合理或待补齐', 'timeline'),
    item.vitals.length
      ? check('通过', '生命体征记录', `已记录 ${item.vitals.length} 条生命体征`, 'vitals')
      : check('未通过', '生命体征记录', '至少需要 1 条生命体征记录', 'vitals'),
    highAlertMissing.length
      ? check('未通过', '高警示药品核对', `${highAlertMissing.length} 条高警示药品缺少核对人`, 'medication')
      : check('通过', '高警示药品核对', '高警示药品核对完整或暂无', 'medication'),
    transfusionMissing.length
      ? check('未通过', '输血双人核对', `${transfusionMissing.length} 条血液制品未完成双人核对`, 'transfusion')
      : check('通过', '输血双人核对', '输血双人核对完整或暂无输血', 'transfusion'),
    unhandled.length
      ? check('未通过', '异常生命体征闭环', `${unhandled.length} 项异常生命体征未记录处置`, 'vitals')
      : check('通过', '异常生命体征闭环', '异常生命体征均已闭环或暂无异常', 'vitals'),
  ];
}

export function runUnifiedRecordQualityChecks(
  item: SurgeryCase,
  dictionaries: { drugs: DrugDictItem[]; vitals: VitalSignDictItem[]; fluids: FluidBloodDictItem[] },
  caseDefects: QualityDefect[] = [],
): LiveRecordQualityCheck[] {
  const recordChecks = runRecordQualityChecks(item).map((row) => ({
    item: row.item,
    status: row.status,
    message: row.message,
    target: row.target,
  } satisfies LiveRecordQualityCheck));
  const liveChecks = runLiveRecordQualityChecks(item, dictionaries);
  const merged = new Map<string, LiveRecordQualityCheck>();
  [...recordChecks, ...liveChecks].forEach((row) => merged.set(row.item, row));
  caseDefects.forEach((defect) => {
    merged.set(`质控缺陷：${defect.defectType}`, {
      item: `质控缺陷：${defect.defectType}`,
      status: defect.defectLevel === '严重' ? '未通过' : '警告',
      message: defect.defectDesc,
      target: 'quality',
    });
  });
  return Array.from(merged.values());
}

export function collectRecordTimes(item: SurgeryCase) {
  return [
    item.anesthesiaStart,
    item.surgeryStart,
    item.surgeryEnd,
    item.leaveRoomTime,
    ...(item.vitals ?? []).map((row) => row.time),
    ...(item.medications ?? []).flatMap((row) => [row.time, row.startTime, row.stopTime, row.endTime]),
    ...(item.fluids ?? []).flatMap((row) => [row.startTime, row.time, row.endTime]),
    ...(item.events ?? []).map((row) => row.time),
    ...(item.anesthesiaPlanes ?? []).map((row) => row.time),
    ...(item.outputRecords ?? []).map((row) => row.time),
  ].filter(Boolean) as string[];
}

export function roundAxisStartTime(time = '08:00', roundMinutes = 30): string {
  const minutes = clockToMinutes(isoOrClockToClock(time)) ?? 0;
  const step = Math.max(1, roundMinutes);
  const rounded = Math.floor(minutes / step) * step;
  return minutesToClock(rounded);
}

export function isRescueModeActive(record: Pick<SurgeryCase, 'rescue'>): boolean {
  return Boolean(record.rescue?.startTime && !record.rescue?.endTime);
}

export function resolveTimeAxisIntervals(record: SurgeryCase): { minorInterval: 5 | 1 | 3 | 10 | 15; majorInterval: number } {
  if (isRescueModeActive(record) || record.vitalFrequency === '抢救1分钟') {
    return { minorInterval: 1, majorInterval: 15 };
  }
  const minor = record.recordDocument?.minorInterval ?? 5;
  const major = record.recordDocument?.majorInterval ?? 30;
  return { minorInterval: minor, majorInterval: major };
}

export const DEFAULT_HOSPITAL_NAME = 'SAMIS 演示医院';

export function buildRecordSnapshot(record: SurgeryCase, hospitalName = DEFAULT_HOSPITAL_NAME): AnesthesiaRecordSnapshot {
  const surgeryDate = record.plannedStart ? new Date(record.plannedStart).toISOString().slice(0, 10) : '';
  return {
    capturedAt: new Date().toISOString(),
    hospitalName,
    recordNo: record.recordDocument?.recordNo ?? record.id,
    patientName: record.patientName,
    gender: record.gender,
    age: record.age,
    height: record.height ?? record.preVisit.height,
    weight: record.preVisit.weight,
    department: record.department,
    bedNo: `${record.sequence}台`,
    inpatientNo: record.patientId ?? record.id,
    paymentMethod: record.paymentMethod ?? '未记录',
    bloodType: record.fluids.find((item) => item.bloodType)?.bloodType,
    asa: record.asa,
    diagnosisPreop: record.diagnosis,
    diagnosisPostop: record.recordSummary?.manualOverrides?.diagnosisPostop?.value ?? record.diagnosis,
    surgeryPlanned: record.surgeryName,
    surgeryActual: record.actualSurgeryName ?? record.surgeryName,
    anesthesiaMethod: record.anesthesiaMethod,
    surgicalPosition: record.position,
    room: record.room,
    surgeonName: record.surgeon,
    anesthesiologistName: record.anesthesiologist,
    nurseName: [record.circulatingNurses, record.scrubNurses].filter(Boolean).join(' / ') || record.anesthesiaNurse,
    circulatingNurseNames: record.circulatingNurses ?? record.anesthesiaNurse,
    scrubNurseNames: record.scrubNurses,
    surgeryDate,
    preMedication: record.preVisit.preMedication,
    fasting: record.preVisit.fasting,
  };
}

export function ensureRecordDocument(record: SurgeryCase): AnesthesiaRecordDocument {
  const { minorInterval, majorInterval } = resolveTimeAxisIntervals(record);
  if (record.recordDocument) {
    return {
      ...record.recordDocument,
      minorInterval,
      majorInterval,
    };
  }
  return {
    recordNo: record.id,
    recordType: 'intraoperative',
    pageCount: 1,
    timeAxisPages: [],
    hospitalName: DEFAULT_HOSPITAL_NAME,
    paymentMethod: record.paymentMethod,
    minorInterval,
    majorInterval,
  };
}

export function syncTransfusionEventsFromFluids(record: SurgeryCase): TransfusionEventRecord[] {
  return record.fluids
    .filter((item) => item.category === '血液制品' || item.category === '自体血回输')
    .map((item, index) => ({
      id: item.id,
      bloodProduct: item.name,
      amount: item.volume,
      amountUnit: item.unit ?? 'U',
      volume: item.volume,
      volumeUnit: item.unit ?? 'ml',
      channelType: item.product,
      startTime: item.startTime ?? item.time ?? '',
      endTime: item.endTime,
      reactionFlag: Boolean(item.reaction && item.reaction !== '无'),
      reactionDescription: item.reaction,
      rowIndex: index,
      status: 'active' as const,
    }));
}

export function buildRecordSummaryFields(record: SurgeryCase): RecordSummaryFields {
  const balance = buildBalanceSummary(record);
  const summary = record.recordSummary ?? {};
  const extubationTime = summary.extubationTime
    ?? record.airwayRecord?.extubationTime
    ?? (record.events.find((item) => item.type.includes('拔管') && item.status !== 'voided')?.time);
  const recoveryTime = summary.recoveryTime ?? record.recoveryRecord?.leaveTime;
  const destination = summary.destination ?? record.transferTo ?? record.recoveryRecord?.destination;
  return {
    crystalTotal: balance.crystalInput,
    colloidTotal: balance.colloidInput,
    bloodTotal: balance.bloodInput,
    bloodProductSummary: balance.bloodProductText,
    urineTotal: balance.urine,
    bloodLossTotal: balance.bloodLoss,
    drainageTotal: balance.drainage,
    inputTotal: balance.totalInput,
    outputTotal: balance.totalOutput,
    anesthesiaEffect: summary.anesthesiaEffect ?? '良',
    analgesiaMethod: summary.analgesiaMethod ?? (record.postoperativeAnalgesia ? 'PCA' : '未记录'),
    extubationTime: extubationTime ? isoOrClockToClock(extubationTime) : undefined,
    recoveryTime: recoveryTime ? isoOrClockToClock(recoveryTime) : undefined,
    destination: destination ? String(destination) : undefined,
    handoverNote: summary.handoverNote ?? record.recoveryRecord?.handoverNote,
    completedAt: summary.completedAt,
    manualOverrides: summary.manualOverrides,
  };
}

export function runPrintPreflightChecks(
  record: SurgeryCase,
  layoutWarnings: Array<{ severity: string }> = [],
): RecordPrintCheck[] {
  const summary = buildRecordSummaryFields(record);
  const balance = buildBalanceSummary(record);
  const checks: RecordPrintCheck[] = [];
  const push = (item: string, status: RecordPrintCheck['status'], message: string) => checks.push({ item, status, message });

  push('患者手术信息', record.patientName && record.surgeryName ? '通过' : '未通过', record.patientName ? '患者与手术信息完整' : '缺少患者或手术信息');
  push('关键时间节点', record.anesthesiaStart && record.surgeryStart ? '通过' : '警告', '建议补齐入室、麻醉开始、手术开始、出室时间');
  push('出入量一致性', summary.inputTotal === balance.totalInput ? '通过' : '警告', '底部汇总与过程合计应一致');
  push('持续泵注', record.medications.some((item) => item.mode === '持续泵入' && item.status !== 'voided' && !item.endTime && !item.stopTime) ? '警告' : '通过', '检查是否存在未结束持续泵注');
  push('未结束液体', record.fluids.some((item) => item.category !== '血液制品' && !item.endTime) ? '警告' : '通过', '检查是否存在未结束液体');
  push('未结束输血', record.fluids.some((item) => item.category === '血液制品' && !item.endTime) ? '警告' : '通过', '检查是否存在未结束输血');
  push('布局重叠', layoutWarnings.some((item) => item.severity === 'error') ? '未通过' : layoutWarnings.length ? '警告' : '通过', layoutWarnings.length ? `存在 ${layoutWarnings.length} 项布局提示` : '未发现严重布局重叠');
  push('页码连续', (record.recordDocument?.pageCount ?? 1) >= 1 ? '通过' : '未通过', `共 ${record.recordDocument?.pageCount ?? 1} 页`);
  return checks;
}

export function saveRecordLocalState(storage: StorageLike, state: RecordLocalState) {
  storage.setItem(RECORD_LOCAL_STATE_KEY, JSON.stringify(state));
}

export function loadRecordLocalState(storage: StorageLike): RecordLocalState {
  const raw = storage.getItem(RECORD_LOCAL_STATE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as RecordLocalState;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    storage.removeItem?.(RECORD_LOCAL_STATE_KEY);
    return {};
  }
}

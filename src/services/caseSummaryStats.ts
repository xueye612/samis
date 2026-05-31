import dayjs from 'dayjs';
import type {
  AnesthesiaEvent,
  FluidRecord,
  MedicationRecord,
  Severity,
  SurgeryCase,
  VitalSign,
} from '@/types/anesthesia';

/**
 * 病例级汇总与质控数据提取（只读纯函数）。
 *
 * 从单个 SurgeryCase 派生用药 / 液体输血 / 出入量 / 事件 / 生命体征极值 / 质控完整性等统计，
 * 供麻醉小结、术后随访、患者详情等页面统一复用，不修改麻醉记录单本体。
 */

export interface MedicationCategoryStat {
  category: string;
  count: number;
  drugs: string[];
}

export interface MedicationSummaryItem {
  id: string;
  drug: string;
  category: string;
  mode: MedicationRecord['mode'];
  doseText: string;
  route?: string;
  checker?: string;
  highAlert: boolean;
  checked: boolean;
}

export interface MedicationSummary {
  total: number;
  continuousCount: number;
  singleCount: number;
  highAlertCount: number;
  uncheckedHighAlertCount: number;
  categories: MedicationCategoryStat[];
  items: MedicationSummaryItem[];
}

export interface FluidCategoryStat {
  category: FluidRecord['category'];
  volume: number;
  count: number;
}

export interface BloodProductItem {
  id: string;
  name: string;
  volume: number;
  unit: string;
  bloodType?: string;
  rh?: string;
  reaction?: string;
  doubleCheck: boolean;
}

export interface FluidSummary {
  crystalloidVolume: number;
  colloidVolume: number;
  bloodVolume: number;
  autologousVolume: number;
  infusionVolume: number;
  intakeVolume: number;
  bloodProductCount: number;
  uncheckedBloodCount: number;
  transfusionReactionCount: number;
  categories: FluidCategoryStat[];
  bloodProducts: BloodProductItem[];
}

export interface OutputSummary {
  urine: number;
  bloodLoss: number;
  drainage: number;
  total: number;
}

export interface BalanceSummary {
  intake: number;
  output: number;
  net: number;
}

export interface EventSummaryItem {
  id: string;
  type: string;
  stage: string;
  severity: Severity;
  treatment: string;
  timeText: string;
  iso: string;
  quality: boolean;
  hasTreatment: boolean;
}

export interface EventSummary {
  total: number;
  qualityCount: number;
  activeCount: number;
  withoutTreatmentCount: number;
  treatmentRate: number;
  bySeverity: Record<string, number>;
  items: EventSummaryItem[];
}

export interface VitalExtreme {
  min?: number;
  max?: number;
}

export interface VitalExtremes {
  HR: VitalExtreme;
  SBP: VitalExtreme;
  SpO2: VitalExtreme;
  TEMP: VitalExtreme;
  hasTemperature: boolean;
  lowestTemp?: number;
}

export type QualityCheckLevel = 'ok' | 'warn' | 'na';

export interface QualityCheckItem {
  key: string;
  label: string;
  level: QualityCheckLevel;
  detail: string;
}

export interface QualityCompleteness {
  items: QualityCheckItem[];
  checkedCount: number;
  passedCount: number;
  missingCount: number;
  completionRate: number;
}

export interface CaseSummaryStats {
  anesthesiaDurationMinutes?: number;
  surgeryDurationMinutes?: number;
  medication: MedicationSummary;
  fluid: FluidSummary;
  output: OutputSummary;
  balance: BalanceSummary;
  event: EventSummary;
  vitalExtremes: VitalExtremes;
  quality: QualityCompleteness;
}

const roundTo = (value: number, digits = 0): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const diffMinutes = (start?: string, end?: string): number | undefined => {
  if (!start || !end) return undefined;
  const minutes = dayjs(end).diff(dayjs(start), 'minute');
  return minutes >= 0 ? minutes : undefined;
};

const formatTime = (value?: string): string => (value ? dayjs(value).format('MM-DD HH:mm') : '');

const isActiveEvent = (event: AnesthesiaEvent): boolean => event.status !== 'voided';

const hasReaction = (reaction?: string): boolean => Boolean(reaction && reaction !== '无' && reaction !== '无反应');

const medicationDoseText = (row: MedicationRecord): string => {
  const dose = `${row.dose ?? ''}${row.unit ?? ''}`.trim();
  if (row.mode === '持续泵入') {
    const parts = [row.pumpRate, row.totalAmount ? `总量${row.totalAmount}` : '', row.concentration].filter(Boolean);
    return parts.join(' / ') || dose || '-';
  }
  return dose || '-';
};

export function buildMedicationSummary(medications: MedicationRecord[] = []): MedicationSummary {
  const active = medications.filter((row) => row.status !== 'voided');
  const categoryMap = new Map<string, MedicationCategoryStat>();
  const items: MedicationSummaryItem[] = [];
  let continuousCount = 0;
  let highAlertCount = 0;
  let uncheckedHighAlertCount = 0;

  active.forEach((row) => {
    const category = row.drugCategory || '未分类';
    const checked = Boolean(row.checker);
    if (row.mode === '持续泵入') continuousCount += 1;
    if (row.highAlert) {
      highAlertCount += 1;
      if (!checked) uncheckedHighAlertCount += 1;
    }
    const entry = categoryMap.get(category) ?? { category, count: 0, drugs: [] };
    entry.count += 1;
    if (!entry.drugs.includes(row.drug)) entry.drugs.push(row.drug);
    categoryMap.set(category, entry);
    items.push({
      id: row.id,
      drug: row.drug,
      category,
      mode: row.mode,
      doseText: medicationDoseText(row),
      route: row.route,
      checker: row.checker,
      highAlert: Boolean(row.highAlert),
      checked,
    });
  });

  return {
    total: active.length,
    continuousCount,
    singleCount: active.length - continuousCount,
    highAlertCount,
    uncheckedHighAlertCount,
    categories: [...categoryMap.values()].sort((a, b) => b.count - a.count),
    items,
  };
}

export function buildFluidSummary(fluids: FluidRecord[] = []): FluidSummary {
  const categoryMap = new Map<FluidRecord['category'], FluidCategoryStat>();
  const bloodProducts: BloodProductItem[] = [];
  let crystalloidVolume = 0;
  let colloidVolume = 0;
  let bloodVolume = 0;
  let autologousVolume = 0;
  let uncheckedBloodCount = 0;
  let transfusionReactionCount = 0;

  fluids.forEach((row) => {
    const volume = Number(row.volume) || 0;
    const entry = categoryMap.get(row.category) ?? { category: row.category, volume: 0, count: 0 };
    entry.volume += volume;
    entry.count += 1;
    categoryMap.set(row.category, entry);

    if (row.category === '晶体液') crystalloidVolume += volume;
    else if (row.category === '胶体液') colloidVolume += volume;
    else if (row.category === '自体血回输') autologousVolume += volume;
    else if (row.category === '血液制品') {
      bloodVolume += volume;
      const doubleCheck = Boolean(row.doubleCheck);
      if (!doubleCheck) uncheckedBloodCount += 1;
      if (hasReaction(row.reaction)) transfusionReactionCount += 1;
      bloodProducts.push({
        id: row.id,
        name: row.name,
        volume,
        unit: row.unit ?? 'ml',
        bloodType: row.bloodType,
        rh: row.rh,
        reaction: row.reaction,
        doubleCheck,
      });
    }
  });

  const infusionVolume = crystalloidVolume + colloidVolume;
  return {
    crystalloidVolume,
    colloidVolume,
    bloodVolume,
    autologousVolume,
    infusionVolume,
    intakeVolume: infusionVolume + bloodVolume + autologousVolume,
    bloodProductCount: bloodProducts.length,
    uncheckedBloodCount,
    transfusionReactionCount,
    categories: [...categoryMap.values()],
    bloodProducts,
  };
}

export function buildOutputSummary(caseItem: SurgeryCase): OutputSummary {
  const details = caseItem.outputRecords ?? [];
  const sumByType = (type: string) => details.filter((row) => row.type === type).reduce((sum, row) => sum + (Number(row.volume) || 0), 0);
  const urine = details.length ? sumByType('尿量') : Number(caseItem.outputs?.urine) || 0;
  const bloodLoss = details.length ? sumByType('出血量') : Number(caseItem.outputs?.bloodLoss) || 0;
  const drainage = details.length ? sumByType('引流量') : Number(caseItem.outputs?.drainage) || 0;
  const other = details.length ? sumByType('其他') : 0;
  return { urine, bloodLoss, drainage, total: urine + bloodLoss + drainage + other };
}

export function buildEventSummary(events: AnesthesiaEvent[] = []): EventSummary {
  const active = events.filter(isActiveEvent);
  const bySeverity: Record<string, number> = {};
  let qualityCount = 0;
  let withoutTreatmentCount = 0;

  const items: EventSummaryItem[] = active
    .map((event) => {
      const hasTreatment = Boolean(event.treatment && event.treatment.trim() && event.treatment !== '待补记');
      if (event.qualityIncluded) qualityCount += 1;
      if (!hasTreatment) withoutTreatmentCount += 1;
      bySeverity[event.severity] = (bySeverity[event.severity] ?? 0) + 1;
      return {
        id: event.id,
        type: event.type,
        stage: event.stage,
        severity: event.severity,
        treatment: event.treatment || '待补记',
        timeText: formatTime(event.time),
        iso: event.time,
        quality: event.qualityIncluded,
        hasTreatment,
      };
    })
    .sort((a, b) => a.iso.localeCompare(b.iso));

  const treatedCount = active.length - withoutTreatmentCount;
  return {
    total: active.length,
    qualityCount,
    activeCount: active.length,
    withoutTreatmentCount,
    treatmentRate: active.length ? roundTo((treatedCount / active.length) * 100, 0) : 100,
    bySeverity,
    items,
  };
}

const extremeFor = (vitals: VitalSign[], key: keyof VitalSign): VitalExtreme => {
  const values = vitals
    .map((row) => row[key])
    .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
  if (!values.length) return {};
  return { min: Math.min(...values), max: Math.max(...values) };
};

export function buildVitalExtremes(vitals: VitalSign[] = []): VitalExtremes {
  const temp = extremeFor(vitals, 'TEMP');
  return {
    HR: extremeFor(vitals, 'HR'),
    SBP: extremeFor(vitals, 'SBP'),
    SpO2: extremeFor(vitals, 'SpO2'),
    TEMP: temp,
    hasTemperature: temp.min !== undefined,
    lowestTemp: temp.min,
  };
}

export interface QualityCompletenessInput {
  summarySigned?: boolean;
}

export function buildQualityCompleteness(
  medication: MedicationSummary,
  fluid: FluidSummary,
  output: OutputSummary,
  event: EventSummary,
  vitalExtremes: VitalExtremes,
  input: QualityCompletenessInput = {},
): QualityCompleteness {
  const items: QualityCheckItem[] = [];

  items.push({
    key: 'temperature',
    label: '体温监测',
    level: vitalExtremes.hasTemperature ? 'ok' : 'warn',
    detail: vitalExtremes.hasTemperature
      ? `最低体温 ${vitalExtremes.lowestTemp}℃`
      : '未记录体温，影响体温监测率',
  });

  items.push({
    key: 'highAlert',
    label: '高警示药品核对',
    level: medication.highAlertCount === 0 ? 'na' : medication.uncheckedHighAlertCount === 0 ? 'ok' : 'warn',
    detail: medication.highAlertCount === 0
      ? '无高警示药品'
      : medication.uncheckedHighAlertCount === 0
        ? `${medication.highAlertCount} 项高警示已核对`
        : `${medication.uncheckedHighAlertCount} 项高警示未双核对`,
  });

  items.push({
    key: 'bloodDoubleCheck',
    label: '血制品双签核对',
    level: fluid.bloodProductCount === 0 ? 'na' : fluid.uncheckedBloodCount === 0 ? 'ok' : 'warn',
    detail: fluid.bloodProductCount === 0
      ? '无血制品输注'
      : fluid.uncheckedBloodCount === 0
        ? `${fluid.bloodProductCount} 袋血制品已双核对`
        : `${fluid.uncheckedBloodCount} 袋血制品未双核对`,
  });

  items.push({
    key: 'eventTreatment',
    label: '事件处理措施',
    level: event.activeCount === 0 ? 'na' : event.withoutTreatmentCount === 0 ? 'ok' : 'warn',
    detail: event.activeCount === 0
      ? '无术中事件'
      : event.withoutTreatmentCount === 0
        ? `事件处理完成率 ${event.treatmentRate}%`
        : `${event.withoutTreatmentCount} 项事件缺处理措施`,
  });

  items.push({
    key: 'bloodLoss',
    label: '出血量记录',
    level: output.bloodLoss > 0 ? 'ok' : 'warn',
    detail: output.bloodLoss > 0 ? `出血量 ${output.bloodLoss}ml` : '未记录出血量',
  });

  if (input.summarySigned !== undefined) {
    items.push({
      key: 'summarySigned',
      label: '麻醉小结签名',
      level: input.summarySigned ? 'ok' : 'warn',
      detail: input.summarySigned ? '已签名' : '小结未签名',
    });
  }

  const checked = items.filter((item) => item.level !== 'na');
  const passed = checked.filter((item) => item.level === 'ok');
  return {
    items,
    checkedCount: checked.length,
    passedCount: passed.length,
    missingCount: checked.length - passed.length,
    completionRate: checked.length ? roundTo((passed.length / checked.length) * 100, 0) : 100,
  };
}

export function buildCaseSummaryStats(
  caseItem: SurgeryCase,
  input: QualityCompletenessInput = {},
): CaseSummaryStats {
  const medication = buildMedicationSummary(caseItem.medications);
  const fluid = buildFluidSummary(caseItem.fluids);
  const output = buildOutputSummary(caseItem);
  const event = buildEventSummary(caseItem.events);
  const vitalExtremes = buildVitalExtremes(caseItem.vitals);
  const quality = buildQualityCompleteness(medication, fluid, output, event, vitalExtremes, input);

  return {
    anesthesiaDurationMinutes: diffMinutes(caseItem.anesthesiaStart, caseItem.anesthesiaEnd),
    surgeryDurationMinutes: diffMinutes(caseItem.surgeryStart, caseItem.surgeryEnd),
    medication,
    fluid,
    output,
    balance: {
      intake: fluid.intakeVolume,
      output: output.total,
      net: fluid.intakeVolume - output.total,
    },
    event,
    vitalExtremes,
    quality,
  };
}

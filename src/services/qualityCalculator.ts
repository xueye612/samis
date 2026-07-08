import dayjs from 'dayjs';
import { HOSPITAL_NAME } from '@/config/hospital';
import { qualityIndicators } from '@/config/qualityIndicators';
import { presentationForIndicator } from '@/config/qualityPresentation';
import { buildQualityMetricDisplayData } from '@/mock/qualityMetricDisplayData';
import { detectQualityDefects } from '@/services/qualityDefectRules';
import type { AnesthesiaCaseTable, QualityDataset } from '@/types/mockTables';
import type {
  AnalysisPoint,
  CaseSummary,
  IndicatorDetail,
  QualityFilter,
  QualityIndicator,
  QualityScopeMeta,
  QualityStatus,
  QualityUnit,
} from '@/types/quality';
import type { QualityIndicatorDetailApi, QualityCaseSummaryApi } from '@/api/quality';

const DEFECT_TYPES_BY_INDICATOR: Record<string, string[]> = {
  'AQI-PVR-04': ['择期手术未完成术前访视'],
  'AQI-TMR-07': ['全麻无体温记录', '手术超过120分钟无体温'],
  'AQI-IHT-10': ['全麻无体温记录'],
  'AQI-PHT-17': ['PACU入室低体温', 'PACU入室无首次体温'],
  'AQI-PDR-18': ['PACU停留超过2小时'],
  'AQI-UICU-20': ['特殊事件无处理措施', '抢救记录未补记'],
  'AQI-PAS-21': ['术后镇痛患者未随访'],
  'AQI-HRS-23': ['插管有记录但拔管无记录'],
};

const activeCases = (dataset: QualityDataset) => dataset.cases.filter((item) => !item.isDeleted && !item.isTest);

const matchesAnesthesiaMethod = (method: string, filterValue: string) => {
  if (filterValue === '全部') return true;
  if (filterValue === '全麻') return method.includes('全身麻醉') || method.includes('静脉');
  if (filterValue === '椎管内麻醉') return method.includes('椎管内');
  if (filterValue === '区域阻滞') return method.includes('阻滞');
  if (filterValue === 'MAC') return method.includes('MAC');
  if (filterValue === '局麻监护') return method.includes('局麻') || method.includes('监护');
  return method.includes(filterValue);
};

const caseDoctor = (dataset: QualityDataset, caseId: string) => {
  const relation = dataset.caseStaff.find((item) => item.caseId === caseId && item.role === '主麻');
  return dataset.staff.find((item) => item.staffId === relation?.staffId)?.staffName ?? '未指定';
};

const categoryLabels: Record<QualityFilter['category'], string> = {
  全部: '全部指标',
  structure: '结构',
  process: '过程',
  outcome: '结果',
  pacu: 'PACU',
  postoperative: '术后',
  obstetric: '产科',
};

const matchCase = (
  item: AnesthesiaCaseTable,
  dataset: QualityDataset,
  filter: QualityFilter,
  options?: { skipTime?: boolean },
) => {
  if (!options?.skipTime) {
    const anchor = item.roomInTime ?? item.createdAt;
    const month = dayjs(anchor).format('YYYY-MM');
    if (month < filter.startMonth || month > filter.endMonth) return false;
  }

  if (filter.anesthesiaMethod !== '全部' && !matchesAnesthesiaMethod(item.anesthesiaMethod, filter.anesthesiaMethod)) return false;
  if (filter.surgeryType !== '全部' && item.surgeryType !== filter.surgeryType) return false;
  if (filter.locationType !== '全部' && item.locationType !== filter.locationType && item.anesthesiaLocation !== filter.locationType) return false;
  if (filter.roomId !== '全部' && item.operatingRoomId !== filter.roomId) return false;
  if (filter.doctorId !== '全部' && caseDoctor(dataset, item.caseId) !== filter.doctorId) return false;

  return true;
};

export interface QualityFilterOutcome {
  cases: AnesthesiaCaseTable[];
  timeScopeRelaxed: boolean;
}

export function resolveQualityFilter(cases: AnesthesiaCaseTable[], dataset: QualityDataset, filter?: QualityFilter): QualityFilterOutcome {
  if (!filter) return { cases, timeScopeRelaxed: false };

  let matched = cases.filter((item) => matchCase(item, dataset, filter));
  let timeScopeRelaxed = false;

  if (matched.length === 0 && cases.length > 0) {
    const relaxed = cases.filter((item) => matchCase(item, dataset, filter, { skipTime: true }));
    if (relaxed.length > 0) {
      matched = relaxed;
      timeScopeRelaxed = true;
    }
  }

  return { cases: matched, timeScopeRelaxed };
}

export function filterCasesForQuality(cases: AnesthesiaCaseTable[], dataset: QualityDataset, filter?: QualityFilter): AnesthesiaCaseTable[] {
  return resolveQualityFilter(cases, dataset, filter).cases;
}

const buildActiveFilterLabels = (filter?: QualityFilter) => {
  if (!filter) return [] as string[];
  const labels: string[] = [];
  if (filter.category !== '全部') labels.push(`指标分类：${categoryLabels[filter.category]}`);
  if (filter.startMonth && filter.endMonth) labels.push(`时间：${filter.startMonth} 至 ${filter.endMonth}`);
  if (filter.anesthesiaMethod !== '全部') labels.push(`麻醉方式：${filter.anesthesiaMethod}`);
  if (filter.locationType !== '全部') labels.push(`手术地点：${filter.locationType}`);
  if (filter.surgeryType !== '全部') labels.push(`手术类型：${filter.surgeryType}`);
  if (filter.roomId !== '全部') labels.push(`手术间：${filter.roomId}`);
  if (filter.doctorId !== '全部') labels.push(`麻醉医生：${filter.doctorId}`);
  return labels;
};

export function buildQualityScopeMeta(dataset: QualityDataset, filter?: QualityFilter): QualityScopeMeta {
  const totalCaseCount = activeCases(dataset).length;
  const { cases: matchedCaseCountCases, timeScopeRelaxed } = resolveQualityFilter(activeCases(dataset), dataset, filter);
  const matchedCaseCount = matchedCaseCountCases.length;
  const activeFilterLabels = buildActiveFilterLabels(filter);
  const caseFiltersActive = activeFilterLabels.some((label) => !label.startsWith('指标分类'));
  const indicatorListTotal = qualityIndicators.length;
  const indicatorListCount =
    !filter || filter.category === '全部' ? indicatorListTotal : qualityIndicators.filter((item) => item.category === filter.category).length;

  let emptyHint: string | undefined;
  if (matchedCaseCount === 0) {
    emptyHint = caseFiltersActive
      ? '当前病例筛选条件下无 Mock 病例，请放宽手术间/医生/麻醉方式等条件，或点击「重置」。'
      : '当前时间范围内无 Mock 病例（演示库已覆盖近 12 个月，可点「最近12个月」或「重置」）。';
  }

  return {
    totalCaseCount,
    matchedCaseCount,
    indicatorListCount,
    indicatorListTotal,
    activeFilterLabels,
    timeScopeRelaxed,
    categoryOnlyFiltersList: activeFilterLabels.length === 1 && activeFilterLabels[0]?.startsWith('指标分类'),
    emptyHint,
  };
}

const rateValue = (numerator: number, denominator: number, unit: QualityUnit) => {
  if (denominator === 0) return 0;
  if (unit === '%') return Number(((numerator / denominator) * 100).toFixed(1));
  if (unit === '‰') return Number(((numerator / denominator) * 1000).toFixed(2));
  return Number((numerator / denominator).toFixed(2));
};

const rateExpression = (numerator: number, denominator: number, unit: QualityUnit) => {
  const suffix = unit === '%' ? ' × 100%' : unit === '‰' ? ' × 1000‰' : '';
  return `${numerator} / ${denominator}${suffix}`;
};

const isCancelAfterRoomIn = (stage?: string) => stage === '入室后' || stage === '入室后麻醉前';
const isCancelAfterAnesthesiaStart = (stage?: string) => stage === '麻醉开始后' || stage === '麻醉开始后手术前';

const casePatient = (dataset: QualityDataset, item: AnesthesiaCaseTable) => dataset.patients.find((patient) => patient.patientId === item.patientId);

const toCaseSummary = (dataset: QualityDataset, item: AnesthesiaCaseTable, defectDesc?: string): CaseSummary => ({
  caseId: item.caseId,
  patientName: casePatient(dataset, item)?.name ?? item.caseId,
  room: item.operatingRoomId,
  department: item.departmentName,
  operationName: item.operationName,
  anesthesiaMethod: item.anesthesiaMethod,
  doctorName: caseDoctor(dataset, item.caseId),
  status: item.status,
  demoTag: item.qualityDemoTag,
  defectDesc,
});

const makeTrend = (current: number, numerator: number, denominator: number) => {
  const base = Number.isFinite(current) ? current : 0;
  return Array.from({ length: 12 }, (_, index) => ({
    month: dayjs().subtract(11 - index, 'month').format('YYYY-MM'),
    value: Number(Math.max(0, base + ((index % 5) - 2) * 1.8).toFixed(1)),
    numerator: Math.max(0, numerator + (index % 3) - 1),
    denominator: Math.max(denominator, denominator + (index % 4) - 2),
  }));
};

const statusOf = (indicator: QualityIndicator, value: number | string, denominator: number): QualityStatus => {
  if (denominator === 0) return 'no-data';
  if (!indicator.warningRule || typeof value !== 'number') return 'normal';
  const { operator, value: threshold } = indicator.warningRule;
  const hit = operator === '<' ? value < threshold : operator === '>' ? value > threshold : operator === '<=' ? value <= threshold : value >= threshold;
  if (!hit) return 'normal';
  return indicator.code.includes('UICU') || indicator.code.includes('PDR') || indicator.code.includes('TMR') ? 'abnormal' : 'warning';
};

const displayValue = (value: number | string, unit: QualityIndicator['unit']) => {
  if (unit === 'ratio') return String(value);
  if (unit === 'count') return `${value}`;
  return `${value}${unit}`;
};

const groupAnalysis = (
  cases: AnesthesiaCaseTable[],
  key: (item: AnesthesiaCaseTable) => string,
  numeratorCases: Set<string>,
  unit: QualityUnit,
): AnalysisPoint[] => {
  const map = new Map<string, { denominator: number; numerator: number }>();
  cases.forEach((item) => {
    const name = key(item);
    const current = map.get(name) ?? { denominator: 0, numerator: 0 };
    current.denominator += 1;
    if (numeratorCases.has(item.caseId)) current.numerator += 1;
    map.set(name, current);
  });
  return [...map.entries()].map(([unitName, value]) => ({
    unitName,
    value: rateValue(value.numerator, value.denominator, unit),
    numerator: value.numerator,
    denominator: value.denominator,
  }));
};

interface IndicatorCalc {
  numeratorCases: AnesthesiaCaseTable[];
  denominatorCases: AnesthesiaCaseTable[];
  value: number | string;
  numerator: number;
  denominator: number;
  expression: string;
  defectCases?: AnesthesiaCaseTable[];
}

function calculateOne(dataset: QualityDataset, indicator: QualityIndicator, filter?: QualityFilter): IndicatorCalc {
  const cases = filterCasesForQuality(activeCases(dataset), dataset, filter);
  const general = cases.filter((item) => item.isGeneralAnesthesia);
  const eventCases = (keyword: string) => cases.filter((item) => dataset.events.some((event) => event.caseId === item.caseId && event.eventType.includes(keyword)));
  const tempCases = general.filter((item) => dataset.vitalSigns.some((record) => record.caseId === item.caseId && typeof record.temp === 'number'));
  const lowTempCases = general.filter((item) => dataset.vitalSigns.some((record) => record.caseId === item.caseId && typeof record.temp === 'number' && record.temp < 36));
  const elective = cases.filter((item) => item.surgeryType === '择期');
  const completedPreVisit = elective.filter((item) => dataset.preVisits.some((visit) => visit.caseId === item.caseId && visit.isCompleted));
  const pacuCases = dataset.pacuRecords
    .map((record) => cases.find((item) => item.caseId === record.caseId))
    .filter(Boolean) as AnesthesiaCaseTable[];
  const pacuLowTemp = dataset.pacuRecords
    .filter((record) => typeof record.firstTemp === 'number' && record.firstTemp < 36)
    .map((record) => cases.find((item) => item.caseId === record.caseId))
    .filter(Boolean) as AnesthesiaCaseTable[];
  const pacuDelay = dataset.pacuRecords
    .filter((record) => dayjs(record.pacuOutTime ?? new Date()).diff(dayjs(record.pacuInTime), 'minute') > 120)
    .map((record) => cases.find((item) => item.caseId === record.caseId))
    .filter(Boolean) as AnesthesiaCaseTable[];
  const intubatedGeneral = general.filter((item) => dataset.airwayRecords.some((record) => record.caseId === item.caseId && record.airwayType === '气管插管'));
  const extubatedCases = cases.filter((item) => dataset.airwayRecords.some((record) => record.caseId === item.caseId && record.extubationTime));
  const transfusionCases = cases.filter((item) =>
    dataset.fluidBloodRecords.some((record) => record.caseId === item.caseId && (record.recordType === '血制品' || record.recordType === '自体血')),
  );
  const upaDenominatorCases = cases.filter((item) => {
    if (!item.isGeneralAnesthesia) return true;
    const airway = dataset.airwayRecords.find((record) => record.caseId === item.caseId);
    return !airway || airway.unplanned;
  });
  const analgesiaFollowups = dataset.postoperativeFollowups.filter((item) => item.followupType === '术后镇痛随访');

  const rateCalc = (
    numeratorCases: AnesthesiaCaseTable[],
    denominatorCases: AnesthesiaCaseTable[],
    unit: QualityUnit,
    defects = numeratorCases,
  ): IndicatorCalc => {
    const numerator = numeratorCases.length;
    const denominator = denominatorCases.length;
    return {
      numeratorCases,
      denominatorCases,
      defectCases: defects,
      numerator,
      denominator,
      value: rateValue(numerator, denominator, unit),
      expression: rateExpression(numerator, denominator, unit),
    };
  };

  switch (indicator.code) {
    case 'AQI-DNR-01': {
      const doctors = dataset.staff.filter((item) => item.staffType === '麻醉医生' && item.isCountedForQuality).length;
      const nurses = dataset.staff.filter((item) => item.staffType === '麻醉护士' && item.isCountedForQuality).length;
      const ratio = doctors === 0 ? 0 : Number((nurses / doctors).toFixed(2));
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const divisor = gcd(nurses, doctors) || 1;
      return {
        numeratorCases: [],
        denominatorCases: [],
        numerator: nurses,
        denominator: doctors,
        value: ratio,
        expression: `${nurses} / ${doctors}（展示 ${nurses / divisor}:${doctors / divisor}）`,
        defectCases: [],
      };
    }
    case 'AQI-ACC-02': {
      const doctors = dataset.staff.filter((item) => item.staffType === '麻醉医生' && item.isCountedForQuality).length;
      const caseCount = cases.length;
      return {
        numeratorCases: cases,
        denominatorCases: [],
        numerator: caseCount,
        denominator: doctors,
        value: Number((caseCount / doctors).toFixed(2)),
        expression: `${caseCount} / ${doctors}`,
      };
    }
    case 'AQI-PAO-03':
      return rateCalc(cases.filter((item) => item.locationType === '手术室外'), cases, '%');
    case 'AQI-PVR-04':
      return rateCalc(completedPreVisit, elective, '%', elective.filter((item) => !completedPreVisit.includes(item)));
    case 'AQI-CRB-05': {
      const numeratorCases = cases.filter((item) => isCancelAfterRoomIn(item.cancelStage));
      return rateCalc(numeratorCases, cases, '‰');
    }
    case 'AQI-CRA-06': {
      const started = cases.filter((item) => item.anesthesiaStartTime);
      const numeratorCases = cases.filter((item) => isCancelAfterAnesthesiaStart(item.cancelStage));
      return rateCalc(numeratorCases, started, '‰');
    }
    case 'AQI-TMR-07':
      return rateCalc(tempCases, general, '%', general.filter((item) => !tempCases.includes(item)));
    case 'AQI-AWR-08': {
      const need = cases.filter((item) => item.isGeneralAnesthesia || item.operationName.includes('剖宫产'));
      const warmed = need.filter((item) => dataset.warmingRecords.some((record) => record.caseId === item.caseId));
      return rateCalc(warmed, need, '%', need.filter((item) => !warmed.includes(item)));
    }
    case 'AQI-ATR-09': {
      const numeratorCases = transfusionCases.filter((item) =>
        dataset.fluidBloodRecords.some((record) => record.caseId === item.caseId && record.recordType === '自体血'),
      );
      return rateCalc(numeratorCases, transfusionCases, '%');
    }
    case 'AQI-IHT-10':
      return rateCalc(lowTempCases, general, '%');
    case 'AQI-DII-11':
      return rateCalc(eventCases('牙齿损伤'), intubatedGeneral, '‰');
    case 'AQI-AAR-12':
      return rateCalc(eventCases('反流误吸'), cases, '‰');
    case 'AQI-UPA-13':
      return rateCalc(
        cases.filter((item) => dataset.airwayRecords.some((record) => record.caseId === item.caseId && record.unplanned)),
        upaDenominatorCases,
        '‰',
      );
    case 'AQI-ICA-14':
      return rateCalc(eventCases('心脏骤停'), cases, '‰');
    case 'AQI-ASA-15':
      return rateCalc(eventCases('严重过敏'), cases, '‰');
    case 'AQI-AWR-16':
      return rateCalc(
        cases.filter((item) => dataset.postoperativeFollowups.some((record) => record.caseId === item.caseId && record.awareness)),
        general,
        '‰',
      );
    case 'AQI-PHT-17':
      return rateCalc(pacuLowTemp, pacuCases, '%');
    case 'AQI-PDR-18':
      return rateCalc(pacuDelay, pacuCases, '%');
    case 'AQI-URI-19':
      return rateCalc(
        cases.filter((item) => dataset.pacuRecords.some((record) => record.caseId === item.caseId && record.reintubation)),
        extubatedCases,
        '‰',
      );
    case 'AQI-UICU-20':
      return rateCalc(cases.filter((item) => item.isTransferIcu && !item.transferIcuPlanned), cases, '%');
    case 'AQI-PAS-21': {
      const numerator = analgesiaFollowups.filter((item) => item.vasScore <= 3);
      const numeratorCases = numerator.map((item) => cases.find((current) => current.caseId === item.caseId)).filter(Boolean) as AnesthesiaCaseTable[];
      const denominatorCases = analgesiaFollowups.map((item) => cases.find((current) => current.caseId === item.caseId)).filter(Boolean) as AnesthesiaCaseTable[];
      return rateCalc(numeratorCases, denominatorCases, '%', denominatorCases.filter((item) => !numeratorCases.includes(item)));
    }
    case 'AQI-RNC-22':
      return rateCalc(
        cases.filter((item) => dataset.postoperativeFollowups.some((record) => record.caseId === item.caseId && record.neuroComplication && (record.neuroDurationHours ?? 0) > 72)),
        cases.filter((item) => item.isRegionalAnesthesia),
        '‰',
      );
    case 'AQI-HRS-23':
      return rateCalc(cases.filter((item) => dataset.postoperativeFollowups.some((record) => record.caseId === item.caseId && record.hoarseness)), intubatedGeneral, '%');
    case 'AQI-NCC-24':
      return rateCalc(cases.filter((item) => dataset.postoperativeFollowups.some((record) => record.caseId === item.caseId && record.newComa)), cases, '‰');
    case 'AQI-D24-25':
      return rateCalc(cases.filter((item) => dataset.postoperativeFollowups.some((record) => record.caseId === item.caseId && record.death24h)), cases, '‰');
    case 'AQI-LEA-26': {
      const vaginal = cases.filter((item) => item.isVaginalDelivery);
      return rateCalc(
        vaginal.filter((item) => item.isNeuraxialAnesthesia),
        vaginal,
        '%',
        vaginal.filter((item) => !item.isNeuraxialAnesthesia),
      );
    }
    default:
      return rateCalc([], cases, '%');
  }
}

const formatDnrDisplay = (nurses: number, doctors: number) => {
  const divisor = (() => {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    return gcd(nurses, doctors) || 1;
  })();
  return `${nurses / divisor}:${doctors / divisor}`;
};

const defectsForIndicator = (indicatorCode: string, defects: ReturnType<typeof detectQualityDefects>, calc: IndicatorCalc) => {
  const mappedTypes = DEFECT_TYPES_BY_INDICATOR[indicatorCode] ?? [];
  return defects.filter(
    (item) =>
      calc.defectCases?.some((caseItem) => caseItem.caseId === item.caseId) ||
      mappedTypes.includes(item.defectType),
  );
};

export function calculateIndicatorDetails(dataset: QualityDataset, filter?: QualityFilter): IndicatorDetail[] {
  const defects = detectQualityDefects(dataset);
  const periodLabel = filter
    ? `${filter.startMonth} 至 ${filter.endMonth}`
    : `${dayjs().subtract(11, 'month').format('YYYY-MM')} 至 ${dayjs().format('YYYY-MM')}`;

  return qualityIndicators.map((indicator, index) => {
    const calc = calculateOne(dataset, indicator, filter);
    const numeratorIds = new Set(calc.numeratorCases.map((item) => item.caseId));
    const status = statusOf(indicator, calc.value, calc.denominator);
    const detailDefects = defectsForIndicator(indicator.code, defects, calc);
    const presentation = presentationForIndicator(indicator);
    const yoy = Number(((index % 4) * 1.1 - 1.3).toFixed(2));
    const mom = Number(((index % 5) * 0.8 - 1.6).toFixed(2));
    const subUnitAnalysis = groupAnalysis(calc.denominatorCases, (item) => item.departmentName, numeratorIds, indicator.unit);
    const doctorAnalysis = groupAnalysis(calc.denominatorCases, (item) => caseDoctor(dataset, item.caseId), numeratorIds, indicator.unit).map((item) => ({
      ...item,
      doctorName: item.unitName,
    }));
    const roomAnalysis = groupAnalysis(calc.denominatorCases, (item) => item.operatingRoomId, numeratorIds, indicator.unit).map((item) => ({
      ...item,
      roomName: item.unitName,
    }));
    const nullAnalysis = buildNullAnalysis(dataset, indicator.code, calc.denominatorCases);
    const numeratorCases = calc.numeratorCases.map((item) => toCaseSummary(dataset, item));
    const denominatorCases = calc.denominatorCases.map((item) => toCaseSummary(dataset, item));
    const defectCases = (calc.defectCases ?? []).map((item) => toCaseSummary(dataset, item, detailDefects.find((defect) => defect.caseId === item.caseId)?.defectDesc));
    const display = indicator.code === 'AQI-DNR-01' ? formatDnrDisplay(calc.numerator, calc.denominator) : displayValue(calc.value, indicator.unit);

    const displayMock = buildQualityMetricDisplayData({
      indicator,
      presentation,
      currentValue: calc.value,
      displayValue: display,
      numerator: calc.numerator,
      denominator: calc.denominator,
      expression: calc.expression,
      status,
      yoy,
      mom,
      index,
      subUnitAnalysis,
      doctorAnalysis,
      roomAnalysis,
      nullAnalysis,
      defectCases,
    });

    return {
      ...indicator,
      ...presentation,
      ...displayMock,
      currentValue: calc.value,
      displayValue: display,
      numerator: calc.numerator,
      denominator: calc.denominator,
      expression: calc.expression,
      period: periodLabel,
      hospitalName: HOSPITAL_NAME,
      yoy,
      mom,
      status,
      favorite: index < 3,
      trend: makeTrend(typeof calc.value === 'number' ? calc.value : calc.numerator, calc.numerator, calc.denominator),
      subUnitAnalysis,
      doctorAnalysis,
      roomAnalysis,
      nullAnalysis,
      numeratorCases,
      denominatorCases,
      defectCases,
    };
  });
}

function buildNullAnalysis(dataset: QualityDataset, indicatorCode: string, denominatorCases: AnesthesiaCaseTable[]) {
  const caseNamesFromIds = (caseIds: string[]) =>
    caseIds
      .map((caseId) => dataset.patients.find((patient) => patient.patientId === dataset.cases.find((item) => item.caseId === caseId)?.patientId)?.name)
      .filter(Boolean) as string[];

  if (indicatorCode === 'AQI-TMR-07') {
    const missing = denominatorCases.filter((item) => !dataset.vitalSigns.some((record) => record.caseId === item.caseId && typeof record.temp === 'number'));
    return [{ fieldName: '体温', missingCount: missing.length, caseNames: caseNamesFromIds(missing.map((item) => item.caseId)) }];
  }

  if (indicatorCode === 'AQI-PHT-17' || indicatorCode === 'AQI-PDR-18') {
    const missing = dataset.pacuRecords
      .filter((record) => denominatorCases.some((item) => item.caseId === record.caseId) && typeof record.firstTemp !== 'number')
      .map((record) => record.caseId);
    return [{ fieldName: 'PACU首次体温', missingCount: missing.length, caseNames: caseNamesFromIds(missing) }];
  }

  return [];
}

/**
 * 按后端病例穿透汇总（QualityCaseSummaryApi）派生维度分析，逻辑与本地 groupAnalysis 对齐，
 * 但维度字段直接取后端汇总（department/doctorName/room），无需 dataset 关联。
 */
const groupSummaryAnalysis = (
  cases: QualityCaseSummaryApi[],
  key: (item: QualityCaseSummaryApi) => string,
  numeratorCases: Set<string>,
  unit: QualityUnit,
): AnalysisPoint[] => {
  const map = new Map<string, { denominator: number; numerator: number }>();
  cases.forEach((item) => {
    const name = key(item) || '未标注';
    const current = map.get(name) ?? { denominator: 0, numerator: 0 };
    current.denominator += 1;
    if (numeratorCases.has(item.caseId)) current.numerator += 1;
    map.set(name, current);
  });
  return [...map.entries()].map(([unitName, value]) => ({
    unitName,
    value: rateValue(value.numerator, value.denominator, unit),
    numerator: value.numerator,
    denominator: value.denominator,
  }));
};

const mapRemoteCaseSummary = (c: QualityCaseSummaryApi): CaseSummary => ({
  caseId: c.caseId,
  patientName: c.patientName,
  room: c.room,
  department: c.department,
  operationName: c.operationName,
  anesthesiaMethod: c.anesthesiaMethod,
  doctorName: c.doctorName,
  status: c.status,
  defectDesc: c.defectDesc ?? undefined,
});

/**
 * T28 混合合并：以本地 TS 计算的 IndicatorDetail 为富展示基底（保留 trend/yoy/mom 演示波形、
 * 标签、图表策略等），再用后端权威值（value/numerator/denominator/status/expression）与穿透
 * cases 覆盖，并基于后端 cases 在 client 侧再派生维度分析；nullAnalysis 后端模式置空（依赖
 * vitalSigns temp，后端不返）。返回新的 IndicatorDetail（不改基底）。
 */
export function mergeRemoteIndicatorDetail(
  base: IndicatorDetail,
  remote: QualityIndicatorDetailApi,
): IndicatorDetail {
  const numericValue = typeof remote.value === 'number' ? remote.value : Number(remote.value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : remote.numerator;

  const numeratorCaseIds = new Set(remote.numeratorCases.map((item) => item.caseId));
  const subUnitAnalysis = groupSummaryAnalysis(remote.denominatorCases, (item) => item.department, numeratorCaseIds, base.unit);
  const doctorAnalysis = groupSummaryAnalysis(remote.denominatorCases, (item) => item.doctorName, numeratorCaseIds, base.unit).map((item) => ({
    ...item,
    doctorName: item.unitName,
  }));
  const roomAnalysis = groupSummaryAnalysis(remote.denominatorCases, (item) => item.room, numeratorCaseIds, base.unit).map((item) => ({
    ...item,
    roomName: item.unitName,
  }));
  const numeratorCases = remote.numeratorCases.map(mapRemoteCaseSummary);
  const denominatorCases = remote.denominatorCases.map(mapRemoteCaseSummary);
  const defectCases = remote.defectCases.map(mapRemoteCaseSummary);
  const trend = makeTrend(safeValue, remote.numerator, remote.denominator);

  const display = buildQualityMetricDisplayData({
    indicator: base,
    presentation: base,
    currentValue: safeValue,
    displayValue: remote.displayValue ?? base.displayValue,
    numerator: remote.numerator,
    denominator: remote.denominator,
    expression: remote.expression ?? base.expression,
    status: remote.status,
    yoy: base.yoy,
    mom: base.mom,
    index: 0,
    subUnitAnalysis,
    doctorAnalysis,
    roomAnalysis,
    nullAnalysis: [],
    defectCases,
  });

  return {
    ...base,
    ...display,
    currentValue: safeValue,
    displayValue: remote.displayValue ?? base.displayValue,
    numerator: remote.numerator,
    denominator: remote.denominator,
    expression: remote.expression ?? base.expression,
    status: remote.status,
    trend,
    subUnitAnalysis,
    doctorAnalysis,
    roomAnalysis,
    nullAnalysis: [],
    numeratorCases,
    denominatorCases,
    defectCases,
  };
}

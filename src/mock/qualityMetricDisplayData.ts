import type {
  AnalysisPoint,
  CaseSummary,
  QualityCategory,
  QualityBetterDirection,
  QualityDisplayChartType,
  QualityIndicator,
  QualityMetricDisplayData,
  QualitySectionChartType,
  QualityPresentation,
  QualityStatus,
} from '@/types/quality';

interface BuildDisplayInput {
  indicator: QualityIndicator;
  presentation: QualityPresentation;
  currentValue: number | string;
  displayValue: string;
  numerator: number;
  denominator: number;
  expression: string;
  status: QualityStatus;
  yoy: number;
  mom: number;
  index: number;
  subUnitAnalysis: AnalysisPoint[];
  doctorAnalysis: AnalysisPoint[];
  roomAnalysis: AnalysisPoint[];
  nullAnalysis: Array<{ fieldName: string; missingCount: number; caseNames: string[] }>;
  defectCases: CaseSummary[];
}

const chartTypeByCode: Record<string, QualityDisplayChartType> = {
  'AQI-DNR-01': 'donut',
  'AQI-ACC-02': 'horizontalBar',
  'AQI-PAO-03': 'donut',
  'AQI-PVR-04': 'area',
  'AQI-CRB-05': 'combo',
  'AQI-CRA-06': 'combo',
  'AQI-TMR-07': 'combo',
  'AQI-AWR-08': 'area',
  'AQI-ATR-09': 'groupedBar',
  'AQI-IHT-10': 'combo',
  'AQI-DII-11': 'horizontalBar',
  'AQI-AAR-12': 'horizontalBar',
  'AQI-UPA-13': 'groupedBar',
  'AQI-ICA-14': 'horizontalBar',
  'AQI-ASA-15': 'horizontalBar',
  'AQI-AWR-16': 'area',
  'AQI-PHT-17': 'combo',
  'AQI-PDR-18': 'combo',
  'AQI-URI-19': 'groupedBar',
  'AQI-UICU-20': 'combo',
  'AQI-PAS-21': 'area',
  'AQI-RNC-22': 'horizontalBar',
  'AQI-HRS-23': 'combo',
  'AQI-NCC-24': 'horizontalBar',
  'AQI-D24-25': 'horizontalBar',
  'AQI-LEA-26': 'area',
};

const statTypeByCategory: Record<QualityCategory, string> = {
  structure: '结构配置',
  process: '过程质量',
  outcome: '结果安全',
  pacu: 'PACU恢复',
  postoperative: '术后随访',
  obstetric: '产科麻醉',
};

const trendWave = [0, 1.8, -0.9, 2.4, 0.6, -1.4, 3.1, 1.2, -0.6, 2.7, -1.1, 0];
const monthLabels = ['07月', '08月', '09月', '10月', '11月', '12月', '01月', '02月', '03月', '04月', '05月', '06月'];

const isRateUnit = (unit: string) => unit === '%' || unit === '‰';

const numericValue = (value: number | string, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

const clamp = (value: number, min = 0, max = 1000) => Math.max(min, Math.min(max, Number(value.toFixed(2))));

const buildTrendData = (input: BuildDisplayInput) => {
  const baseValue = numericValue(input.currentValue, input.numerator);
  const baseDenominator = Math.max(input.denominator || input.numerator || 1, 1);
  const ratio = input.denominator > 0 ? input.numerator / input.denominator : 0.35;

  return monthLabels.map((month, index) => {
    const denominatorValue = Math.max(1, baseDenominator + ((index % 5) - 2) * 2 + Math.floor(index / 3));
    const numeratorValue = Math.max(0, Math.min(denominatorValue, Math.round(denominatorValue * Math.max(0.02, ratio + (trendWave[index] / 100)))));
    const value =
      input.indicator.unit === 'ratio'
        ? Number((Math.max(0.1, input.numerator + (index % 3) - 1) / Math.max(1, input.denominator + ((index + 1) % 3))).toFixed(2))
        : input.indicator.unit === 'count'
          ? clamp(baseValue + trendWave[index] * 8, 0, 9999)
          : clamp(baseValue + trendWave[index], 0, input.indicator.unit === '%' ? 100 : 1000);

    return { month, value, numeratorValue, denominatorValue };
  });
};

interface SectionStrategy {
  yearTrendChartType: QualitySectionChartType;
  quarterChartType: QualitySectionChartType;
  monthGrowthChartType: QualitySectionChartType;
  distributionChartType: QualitySectionChartType;
  showTargetLine: boolean;
  targetValue?: number;
  betterDirection: QualityBetterDirection;
}

const higherBetterCodes = new Set(['AQI-PVR-04', 'AQI-TMR-07', 'AQI-AWR-08', 'AQI-ATR-09', 'AQI-PAS-21', 'AQI-LEA-26']);
const structureCodes = new Set(['AQI-DNR-01', 'AQI-PAO-03']);
const averageCodes = new Set(['AQI-ACC-02']);

const targetValueByCode: Record<string, number> = {
  'AQI-PVR-04': 95,
  'AQI-TMR-07': 90,
  'AQI-AWR-08': 85,
  'AQI-ATR-09': 20,
  'AQI-PAS-21': 90,
  'AQI-LEA-26': 45,
};

const sectionStrategy = (indicator: QualityIndicator): SectionStrategy => {
  if (structureCodes.has(indicator.code)) {
    return {
      yearTrendChartType: 'stackedBar',
      quarterChartType: 'stackedBar',
      monthGrowthChartType: 'growthBar',
      distributionChartType: 'stackedHorizontalBar',
      showTargetLine: false,
      betterDirection: 'neutral',
    };
  }

  if (averageCodes.has(indicator.code)) {
    return {
      yearTrendChartType: 'line',
      quarterChartType: 'bar',
      monthGrowthChartType: 'growthBar',
      distributionChartType: 'horizontalBar',
      showTargetLine: false,
      betterDirection: 'neutral',
    };
  }

  if (higherBetterCodes.has(indicator.code)) {
    return {
      yearTrendChartType: 'areaTarget',
      quarterChartType: 'barTarget',
      monthGrowthChartType: 'growthBar',
      distributionChartType: indicator.supportDoctorAnalysis || indicator.supportRoomAnalysis ? 'horizontalBar' : 'groupedBar',
      showTargetLine: true,
      targetValue: targetValueByCode[indicator.code] ?? (indicator.unit === '‰' ? 1 : 90),
      betterDirection: 'higher',
    };
  }

  return {
    yearTrendChartType: indicator.unit === 'count' ? 'abnormalBar' : 'combo',
    quarterChartType: 'abnormalBar',
    monthGrowthChartType: 'growthBar',
    distributionChartType: indicator.supportDoctorAnalysis || indicator.supportRoomAnalysis ? 'horizontalBar' : 'groupedBar',
    showTargetLine: false,
    betterDirection: 'lower',
  };
};

const buildQuarterData = (trendData: ReturnType<typeof buildTrendData>) =>
  ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, index) => {
    const items = trendData.slice(index * 3, index * 3 + 3);
    const numeratorValue = items.reduce((sum, item) => sum + item.numeratorValue, 0);
    const denominatorValue = Math.max(1, items.reduce((sum, item) => sum + item.denominatorValue, 0));
    const value = Number((items.reduce((sum, item) => sum + item.value, 0) / Math.max(1, items.length)).toFixed(2));
    return { quarter, value, numeratorValue, denominatorValue };
  });

const isImproved = (changeValue: number, betterDirection: QualityBetterDirection) => {
  if (betterDirection === 'neutral') return Math.abs(changeValue) <= 1;
  return betterDirection === 'higher' ? changeValue >= 0 : changeValue <= 0;
};

const buildMonthGrowthData = (trendData: ReturnType<typeof buildTrendData>, betterDirection: QualityBetterDirection) =>
  trendData.slice(1).map((item, index) => {
    const previousValue = trendData[index].value;
    const changeValue = Number((item.value - previousValue).toFixed(2));
    const changePercent = previousValue ? Number(((changeValue / previousValue) * 100).toFixed(2)) : 0;
    return {
      month: item.month,
      value: item.value,
      previousValue,
      changeValue,
      changePercent,
      isImproved: isImproved(changeValue, betterDirection),
    };
  });

const buildCompositionData = (input: BuildDisplayInput) => {
  if (input.indicator.code === 'AQI-DNR-01') {
    return [
      { name: input.presentation.numeratorShortLabel, value: input.numerator },
      { name: input.presentation.denominatorShortLabel, value: input.denominator },
    ];
  }

  const included = Math.min(input.numerator, Math.max(input.denominator, input.numerator));
  const remaining = Math.max(0, input.denominator - included);
  return [
    { name: input.presentation.numeratorShortLabel, value: included },
    { name: `未计入${input.presentation.numeratorShortLabel}`, value: remaining },
  ];
};

type RankingRows = QualityMetricDisplayData['rankingData'];

const normalizeRows = (rows: AnalysisPoint[], fallbackPrefix: string, input: BuildDisplayInput): RankingRows => {
  if (rows.length > 0) {
    return rows.slice(0, 6).map((row, index) => ({
      name: row.unitName ?? row.doctorName ?? row.roomName ?? `${fallbackPrefix}${index + 1}`,
      value: row.value,
      numeratorValue: row.numerator,
      denominatorValue: row.denominator,
      status: row.value > numericValue(input.currentValue, 0) ? 'warning' : 'normal',
    }));
  }

  const names = ['OR-01', 'OR-02', 'OR-03', 'OR-05', 'PACU', '内镜中心'];
  return names.map((name, index) => {
    const denominatorValue = Math.max(2, input.denominator + index - 2);
    const numeratorValue = Math.min(denominatorValue, Math.max(0, input.numerator + (index % 3) - 1));
    const value = denominatorValue ? Number(((numeratorValue / denominatorValue) * (input.indicator.unit === '‰' ? 1000 : 100)).toFixed(1)) : 0;
    return {
      name,
      value: isRateUnit(input.indicator.unit) ? value : numeratorValue,
      numeratorValue,
      denominatorValue,
      status: index === 1 && input.status !== 'normal' ? input.status : 'normal',
    };
  });
};

const chartTitle = (chartType: QualityDisplayChartType, metricName: string) => {
  if (chartType === 'donut') return `${metricName}结构构成`;
  if (chartType === 'horizontalBar') return `${metricName}重点维度排行`;
  if (chartType === 'groupedBar') return `${metricName}维度对比`;
  if (chartType === 'area') return `${metricName}趋势变化`;
  return `${metricName}趋势与病例数量`;
};

const chartDescription = (chartType: QualityDisplayChartType, input: BuildDisplayInput) => {
  if (chartType === 'donut') return `展示${input.presentation.numeratorLabel}与${input.presentation.denominatorLabel}的结构关系。`;
  if (chartType === 'horizontalBar') return `按手术间、医生或科室展示${input.presentation.numeratorShortLabel}的分布，便于定位重点单元。`;
  if (chartType === 'groupedBar') return `对比不同维度下${input.presentation.numeratorShortLabel}与${input.presentation.denominatorShortLabel}的数量关系。`;
  if (chartType === 'area') return `面积折线展示指标值波动，辅助观察连续改进趋势。`;
  return `折线展示指标值，柱状展示${input.presentation.numeratorShortLabel}和${input.presentation.denominatorShortLabel}。`;
};

export function buildQualityMetricDisplayData(input: BuildDisplayInput): QualityMetricDisplayData {
  const chartType = chartTypeByCode[input.indicator.code] ?? input.presentation.displayChartType;
  const rankingBase = input.indicator.supportDoctorAnalysis ? input.doctorAnalysis : input.indicator.supportRoomAnalysis ? input.roomAnalysis : input.subUnitAnalysis;
  const rankingData = normalizeRows(rankingBase, '单元', input);
  const trendData = buildTrendData(input);
  const strategy = sectionStrategy(input.indicator);

  return {
    metricCode: input.indicator.code,
    metricName: input.indicator.name,
    metricCategory: input.indicator.category,
    statType: statTypeByCategory[input.indicator.category],
    unit: input.indicator.unit,
    currentValue: input.currentValue,
    currentStatus: input.status,
    yoyValue: input.yoy,
    yoyLabel: `较去年同期 ${input.yoy >= 0 ? '+' : ''}${input.yoy}%（演示）`,
    momValue: input.mom,
    momLabel: `较上期 ${input.mom >= 0 ? '+' : ''}${input.mom}%（演示）`,
    description: input.presentation.metricInterpretation,
    formulaText: input.indicator.formulaText,
    formulaExpression: input.expression,
    numeratorLabel: input.presentation.numeratorLabel,
    denominatorLabel: input.presentation.denominatorLabel,
    numeratorShortLabel: input.presentation.numeratorShortLabel,
    denominatorShortLabel: input.presentation.denominatorShortLabel,
    numeratorValue: input.numerator,
    denominatorValue: input.denominator,
    dataSources: input.indicator.dataSources,
    exclusionRules: ['测试病例不纳入统计', '作废病例不纳入统计', '取消病例按指标口径处理'],
    chartType,
    chartTitle: chartTitle(chartType, input.indicator.name),
    chartDescription: chartDescription(chartType, input),
    chartSections: ['summary', 'yearTrend', 'quarterCompare', 'monthGrowth', 'dimensionDistribution', 'detail'],
    yearTrendChartType: strategy.yearTrendChartType,
    quarterChartType: strategy.quarterChartType,
    monthGrowthChartType: strategy.monthGrowthChartType,
    distributionChartType: strategy.distributionChartType,
    showTargetLine: strategy.showTargetLine,
    targetValue: strategy.targetValue,
    betterDirection: strategy.betterDirection,
    trendData,
    yearTrendData: trendData,
    quarterCompareData: buildQuarterData(trendData),
    monthGrowthData: buildMonthGrowthData(trendData, strategy.betterDirection),
    compositionData: buildCompositionData(input),
    rankingData,
    dimensionDistributionData: rankingData,
    detailTabsData: {
      subUnits: normalizeRows(input.subUnitAnalysis, '科室', input),
      subEntities: normalizeRows([...input.doctorAnalysis, ...input.roomAnalysis], '实体', input),
      nullValues: input.nullAnalysis,
      abnormalCases: input.defectCases,
    },
  };
}

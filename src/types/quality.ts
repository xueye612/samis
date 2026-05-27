export type QualityCategory = 'structure' | 'process' | 'outcome' | 'pacu' | 'postoperative' | 'obstetric';
export type QualityUnit = '%' | '‰' | 'ratio' | 'count';
export type QualityChartType = 'line' | 'bar' | 'gauge' | 'mixed';
export type QualityDisplayChartType = 'combo' | 'donut' | 'bar' | 'line' | 'area' | 'horizontalBar' | 'groupedBar' | 'stackedBar';
export type QualityChartSection = 'summary' | 'yearTrend' | 'quarterCompare' | 'monthGrowth' | 'dimensionDistribution' | 'detail';
export type QualitySectionChartType =
  | 'combo'
  | 'areaTarget'
  | 'line'
  | 'stackedBar'
  | 'bar'
  | 'barTarget'
  | 'growthBar'
  | 'horizontalBar'
  | 'groupedBar'
  | 'stackedHorizontalBar'
  | 'abnormalBar';
export type QualityBetterDirection = 'higher' | 'lower' | 'neutral';
export type QualityTrendMode = 'monthlyTrend' | 'structure' | 'distribution' | 'none';
export type QualityStatus = 'normal' | 'warning' | 'abnormal' | 'no-data';
export type DefectLevel = '一般' | '重要' | '严重';
export type DefectStatus = '待确认' | '待整改' | '已整改' | '已关闭';

export interface QualityPresentation {
  displayChartType: QualityDisplayChartType;
  trendChartMode: QualityTrendMode;
  numeratorLabel: string;
  denominatorLabel: string;
  numeratorShortLabel: string;
  denominatorShortLabel: string;
  metricInterpretation: string;
  detailDimensionSuggestions: string[];
}

export interface QualityTrendDatum {
  month: string;
  value: number;
  numeratorValue: number;
  denominatorValue: number;
}

export interface QualityCompositionDatum {
  name: string;
  value: number;
  percent?: number;
}

export interface QualityRankingDatum {
  name: string;
  value: number;
  numeratorValue: number;
  denominatorValue: number;
  status?: QualityStatus;
}

export interface QualityQuarterDatum {
  quarter: string;
  value: number;
  numeratorValue: number;
  denominatorValue: number;
}

export interface QualityMonthGrowthDatum {
  month: string;
  value: number;
  previousValue: number;
  changeValue: number;
  changePercent: number;
  isImproved: boolean;
}

export interface QualityMetricDisplayData {
  metricCode: string;
  metricName: string;
  metricCategory: QualityCategory;
  statType: string;
  unit: QualityUnit;
  currentValue: number | string;
  currentStatus: QualityStatus;
  yoyValue: number;
  yoyLabel: string;
  momValue: number;
  momLabel: string;
  description: string;
  formulaText: string;
  formulaExpression: string;
  numeratorLabel: string;
  denominatorLabel: string;
  numeratorShortLabel: string;
  denominatorShortLabel: string;
  numeratorValue: number;
  denominatorValue: number;
  dataSources: string[];
  exclusionRules: string[];
  chartType: QualityDisplayChartType;
  chartTitle: string;
  chartDescription: string;
  chartSections: QualityChartSection[];
  yearTrendChartType: QualitySectionChartType;
  quarterChartType: QualitySectionChartType;
  monthGrowthChartType: QualitySectionChartType;
  distributionChartType: QualitySectionChartType;
  showTargetLine: boolean;
  targetValue?: number;
  betterDirection: QualityBetterDirection;
  trendData: QualityTrendDatum[];
  yearTrendData: QualityTrendDatum[];
  quarterCompareData: QualityQuarterDatum[];
  monthGrowthData: QualityMonthGrowthDatum[];
  compositionData: QualityCompositionDatum[];
  rankingData: QualityRankingDatum[];
  dimensionDistributionData: QualityRankingDatum[];
  detailTabsData: {
    subUnits: QualityRankingDatum[];
    subEntities: QualityRankingDatum[];
    nullValues: Array<{ fieldName: string; missingCount: number; caseNames: string[] }>;
    abnormalCases: CaseSummary[];
  };
}

export interface QualityIndicator {
  code: string;
  name: string;
  category: QualityCategory;
  unit: QualityUnit;
  numeratorName: string;
  denominatorName: string;
  formulaText: string;
  dataSources: string[];
  defaultChartType: QualityChartType;
  supportDrillDown: boolean;
  supportDoctorAnalysis: boolean;
  supportRoomAnalysis: boolean;
  warningRule?: {
    operator: '>' | '<' | '>=' | '<=';
    value: number;
  };
}

export interface QualityFilter {
  periodType: '月度' | '季度' | '年度' | '自定义';
  startMonth: string;
  endMonth: string;
  category: '全部' | QualityCategory;
  anesthesiaMethod: string;
  locationType: string;
  surgeryType: string;
  doctorId: string;
  roomId: string;
}

export interface CaseSummary {
  caseId: string;
  patientName: string;
  room: string;
  department: string;
  operationName: string;
  anesthesiaMethod: string;
  doctorName: string;
  status: string;
  demoTag?: string;
  defectDesc?: string;
}

export interface QualityScopeMeta {
  totalCaseCount: number;
  matchedCaseCount: number;
  indicatorListCount: number;
  indicatorListTotal: number;
  activeFilterLabels: string[];
  timeScopeRelaxed: boolean;
  categoryOnlyFiltersList: boolean;
  emptyHint?: string;
}

export interface TrendPoint {
  month: string;
  value: number;
  numerator: number;
  denominator: number;
}

export interface AnalysisPoint {
  unitName?: string;
  doctorName?: string;
  roomName?: string;
  value: number;
  numerator: number;
  denominator: number;
}

export interface IndicatorDetail extends QualityIndicator, QualityPresentation, QualityMetricDisplayData {
  currentValue: number | string;
  displayValue: string;
  numerator: number;
  denominator: number;
  expression: string;
  period: string;
  hospitalName: string;
  yoy: number;
  mom: number;
  status: QualityStatus;
  favorite: boolean;
  trend: TrendPoint[];
  subUnitAnalysis: AnalysisPoint[];
  doctorAnalysis: AnalysisPoint[];
  roomAnalysis: AnalysisPoint[];
  nullAnalysis: Array<{ fieldName: string; missingCount: number; caseNames: string[] }>;
  numeratorCases: CaseSummary[];
  denominatorCases: CaseSummary[];
  defectCases: CaseSummary[];
}

export interface QualityDefect {
  defectId: string;
  caseId: string;
  patientName: string;
  room: string;
  defectType: string;
  defectLevel: DefectLevel;
  defectDesc: string;
  responsibleStaff: string;
  discoveredTime: string;
  status: DefectStatus;
  rectificationNote: string;
  reviewer: string;
  reviewTime?: string;
  source: string;
}

export const qualityCategoryLabels: Record<QualityCategory, string> = {
  structure: '结构',
  process: '过程',
  outcome: '结果',
  pacu: 'PACU',
  postoperative: '术后',
  obstetric: '产科',
};

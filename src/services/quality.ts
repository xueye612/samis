import { getQualityDataset } from '@/services/mockApi';
import { calculateIndicatorDetails } from '@/services/qualityCalculator';
import { detectQualityDefects } from '@/services/qualityDefectRules';
import type { PacuPatient, PostoperativeFollowUp, QualityIndicatorResult, SurgeryCase } from '@/types/anesthesia';

export const findQualityDefects = () => detectQualityDefects(getQualityDataset());

export const calculateQualityDashboard = (): QualityIndicatorResult[] =>
  calculateIndicatorDetails(getQualityDataset()).map((item) => ({
    code: item.code,
    group: item.category === 'structure' ? '结构' : item.category === 'process' ? '过程' : item.category === 'outcome' ? '结果' : item.category === 'postoperative' ? '术后' : item.category === 'obstetric' ? '产科' : 'PACU',
    name: item.name,
    numerator: item.numeratorName,
    denominator: item.denominatorName,
    target: item.warningRule ? `${item.warningRule.operator}${item.warningRule.value}${item.unit === 'count' || item.unit === 'ratio' ? '' : item.unit}` : '监测',
    currentValue: item.displayValue,
    trend: item.trend.map((point) => point.value),
    abnormalCases: item.defectCases.map((caseItem) => caseItem.patientName),
  }));

export function findQualityDefectsCompat(_cases?: SurgeryCase[], _pacu?: PacuPatient[], _followUps?: PostoperativeFollowUp[]) {
  return detectQualityDefects(getQualityDataset());
}

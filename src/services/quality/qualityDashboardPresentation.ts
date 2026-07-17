import type { QualityIndicatorApi, QualityIndicatorDetailApi, QualityCaseSummaryApi } from '@/api/quality';
import { qualityCategoryLabels, type QualityCategory } from '@/types/quality';

export interface QualityDashboardCard {
  code: string;
  name: string;
  category: QualityCategory;
  categoryLabel: string;
  displayValue: string;
  numerator: number;
  denominator: number;
  status: QualityIndicatorApi['status'];
  statusLabel: string;
  target: string | null;
  met: boolean;
}

export interface QualityCategorySummary {
  key: QualityCategory;
  label: string;
  total: number;
  withData: number;
  abnormal: number;
}

const statusLabels: Record<QualityIndicatorApi['status'], string> = {
  normal: '正常',
  warning: '预警',
  abnormal: '异常',
  'no-data': '无数据',
};

export function buildIndicatorCards(rows: QualityIndicatorApi[]): QualityDashboardCard[] {
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    category: row.category,
    categoryLabel: qualityCategoryLabels[row.category],
    displayValue: row.displayValue,
    numerator: Number(row.numerator) || 0,
    denominator: Number(row.denominator) || 0,
    status: row.status,
    statusLabel: statusLabels[row.status],
    target: row.target,
    met: row.met,
  }));
}

export function buildCategorySummary(rows: QualityIndicatorApi[]): QualityCategorySummary[] {
  const ordered: QualityCategory[] = ['structure', 'process', 'outcome', 'pacu', 'postoperative', 'obstetric'];
  return ordered.flatMap((key) => {
    const items = rows.filter((row) => row.category === key);
    if (!items.length) return [];
    return [{
      key,
      label: qualityCategoryLabels[key],
      total: items.length,
      withData: items.filter((row) => row.status !== 'no-data').length,
      abnormal: items.filter((row) => row.status === 'abnormal' || row.status === 'warning').length,
    }];
  });
}

export function buildStatusSummary(rows: QualityIndicatorApi[]) {
  const ordered: QualityIndicatorApi['status'][] = ['normal', 'warning', 'abnormal', 'no-data'];
  return ordered.flatMap((key) => {
    const value = rows.filter((row) => row.status === key).length;
    return value ? [{ key, label: statusLabels[key], value }] : [];
  });
}

export function normalizeDrilldownRows(
  detail: QualityIndicatorDetailApi | null,
  kind: 'numerator' | 'denominator' | 'defect',
): QualityCaseSummaryApi[] {
  if (!detail) return [];
  if (kind === 'numerator') return detail.numeratorCases ?? [];
  if (kind === 'denominator') return detail.denominatorCases ?? [];
  return detail.defectCases ?? [];
}

export const qualityStatusLabel = (status: QualityIndicatorApi['status']) => statusLabels[status];

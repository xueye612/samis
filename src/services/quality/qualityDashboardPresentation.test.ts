import { describe, expect, it } from 'vitest';
import type { QualityIndicatorApi, QualityIndicatorDetailApi } from '@/api/quality';
import {
  buildCategorySummary,
  buildIndicatorCards,
  buildStatusSummary,
  normalizeDrilldownRows,
} from './qualityDashboardPresentation';

const indicator = (patch: Partial<QualityIndicatorApi> = {}): QualityIndicatorApi => ({
  code: 'AQI-01',
  name: '术中低体温发生率',
  category: 'process',
  unit: '%',
  numerator: 2,
  denominator: 20,
  rate: 10,
  value: 10,
  expression: '2 / 20 × 100%',
  displayValue: '10%',
  target: '<5%',
  warningRule: { operator: '>', value: 5 },
  met: false,
  status: 'abnormal',
  denominatorDefinition: '纳入全麻病例',
  numeratorDefinition: '核心体温低于36℃病例',
  exclusions: ['体温缺失'],
  timeWindow: { anchor: '手术结束', granularity: 'month', timezone: 'Asia/Shanghai' },
  evidenceFields: ['vitals.TEMP'],
  severity: '重要',
  drilldown: { denominator: true, numerator: true, defect: true },
  remediationAction: '复核保温流程',
  ...patch,
});

describe('qualityDashboardPresentation', () => {
  it('keeps backend values authoritative and never invents trend points', () => {
    const cards = buildIndicatorCards([indicator()]);
    expect(cards).toEqual([expect.objectContaining({ code: 'AQI-01', displayValue: '10%', numerator: 2, denominator: 20 })]);
    expect(cards[0]).not.toHaveProperty('trend');
    expect(cards[0]).not.toHaveProperty('mock');
  });

  it('summarizes category and status from the complete real indicator list', () => {
    const rows = [
      indicator(),
      indicator({ code: 'AQI-02', category: 'outcome', status: 'normal', met: true }),
      indicator({ code: 'AQI-03', category: 'process', status: 'no-data', numerator: 0, denominator: 0 }),
    ];
    expect(buildCategorySummary(rows)).toEqual([
      { key: 'process', label: '过程', total: 2, withData: 1, abnormal: 1 },
      { key: 'outcome', label: '结果', total: 1, withData: 1, abnormal: 0 },
    ]);
    expect(buildStatusSummary(rows)).toEqual([
      { key: 'normal', label: '正常', value: 1 },
      { key: 'abnormal', label: '异常', value: 1 },
      { key: 'no-data', label: '无数据', value: 1 },
    ]);
  });

  it('uses only backend drilldown cases and preserves operation identifiers', () => {
    const detail: QualityIndicatorDetailApi = {
      ...indicator(),
      numeratorCases: [{ caseId: 'OP-1', patientName: '患者一', room: 'OR-01', department: '普外科', operationName: '手术一', anesthesiaMethod: '全麻', doctorName: '医生一', status: '完成' }],
      denominatorCases: [],
      defectCases: [{ caseId: 'OP-2', patientName: '患者二', room: 'OR-02', department: '骨科', operationName: '手术二', anesthesiaMethod: '椎管内', doctorName: '医生二', status: '完成', defectDesc: '低体温' }],
      totals: { numeratorCount: 1, denominatorCount: 2 },
    };
    expect(normalizeDrilldownRows(detail, 'defect')).toEqual([
      expect.objectContaining({ caseId: 'OP-2', defectDesc: '低体温' }),
    ]);
  });
});

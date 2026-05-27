import dayjs from 'dayjs';
import { qualityIndicators } from '@/config/qualityIndicators';
import { getQualityDataset } from '@/services/mockApi';
import { buildQualityScopeMeta, calculateIndicatorDetails, filterCasesForQuality } from '@/services/qualityCalculator';
import { detectQualityDefects } from '@/services/qualityDefectRules';

describe('quality indicator configuration', () => {
  it('defines the 26 nationally referenced anesthesia quality indicators with required metadata', () => {
    expect(qualityIndicators).toHaveLength(26);
    expect(new Set(qualityIndicators.map((item) => item.code)).size).toBe(26);
    expect(qualityIndicators.map((item) => item.code)).toEqual([
      'AQI-DNR-01',
      'AQI-ACC-02',
      'AQI-PAO-03',
      'AQI-PVR-04',
      'AQI-CRB-05',
      'AQI-CRA-06',
      'AQI-TMR-07',
      'AQI-AWR-08',
      'AQI-ATR-09',
      'AQI-IHT-10',
      'AQI-DII-11',
      'AQI-AAR-12',
      'AQI-UPA-13',
      'AQI-ICA-14',
      'AQI-ASA-15',
      'AQI-AWR-16',
      'AQI-PHT-17',
      'AQI-PDR-18',
      'AQI-URI-19',
      'AQI-UICU-20',
      'AQI-PAS-21',
      'AQI-RNC-22',
      'AQI-HRS-23',
      'AQI-NCC-24',
      'AQI-D24-25',
      'AQI-LEA-26',
    ]);

    qualityIndicators.forEach((item) => {
      expect(item.name).toBeTruthy();
      expect(item.category).toMatch(/structure|process|outcome|pacu|postoperative|obstetric/);
      expect(item.numeratorName).toBeTruthy();
      expect(item.denominatorName).toBeTruthy();
      expect(item.formulaText).toContain('/');
      expect(item.dataSources.length).toBeGreaterThan(0);
      expect(item.supportDrillDown).toBe(true);
    });
  });
});

describe('quality calculation', () => {
  it('returns indicator detail with numerator, denominator, trends and drill-down case lists', () => {
    const dataset = getQualityDataset();
    const details = calculateIndicatorDetails(dataset);
    const byCode = Object.fromEntries(details.map((item) => [item.code, item]));

    expect(details).toHaveLength(26);
    expect(byCode['AQI-TMR-07'].denominator).toBeGreaterThanOrEqual(10);
    expect(byCode['AQI-TMR-07'].numerator).toBeGreaterThan(0);
    expect(byCode['AQI-TMR-07'].currentValue).toBeGreaterThan(0);
    expect(byCode['AQI-TMR-07'].expression).toMatch(/4 \/ \d+ × 100%/);
    expect(byCode['AQI-TMR-07'].trend).toHaveLength(12);
    expect(byCode['AQI-TMR-07'].denominatorCases.map((item) => item.room)).toContain('OR-02');
    expect(byCode['AQI-PDR-18'].defectCases.map((item) => item.patientName)).toContain('周明');
    expect(byCode['AQI-UICU-20'].defectCases.map((item) => item.room)).toContain('OR-05');
  });

  it('calculates permille indicators with ×1000 scaling', () => {
    const byCode = Object.fromEntries(calculateIndicatorDetails(getQualityDataset()).map((item) => [item.code, item]));

    expect(byCode['AQI-CRA-06'].currentValue).toBe(47.62);
    expect(byCode['AQI-CRA-06'].displayValue).toBe('47.62‰');
    expect(byCode['AQI-CRA-06'].expression).toMatch(/1 \/ \d+ × 1000‰/);
    expect(byCode['AQI-DII-11'].currentValue).toBe(0);
    expect(byCode['AQI-DII-11'].denominator).toBe(4);
    expect(byCode['AQI-DII-11'].displayValue).toBe('0‰');
  });

  it('uses corrected denominators for ATR, URI and ACC', () => {
    const byCode = Object.fromEntries(calculateIndicatorDetails(getQualityDataset()).map((item) => [item.code, item]));

    expect(byCode['AQI-ATR-09'].numerator).toBe(1);
    expect(byCode['AQI-ATR-09'].denominator).toBe(2);
    expect(byCode['AQI-ATR-09'].currentValue).toBe(50);
    expect(byCode['AQI-URI-19'].denominator).toBe(2);
    expect(byCode['AQI-ACC-02'].numerator).toBe(22);
    expect(byCode['AQI-ACC-02'].denominator).toBe(6);
    expect(byCode['AQI-ACC-02'].expression).toBe('22 / 6');
  });

  it('formats nurse-to-doctor ratio for DNR-01 and applies numeric warning', () => {
    const dnr = calculateIndicatorDetails(getQualityDataset()).find((item) => item.code === 'AQI-DNR-01');

    expect(dnr?.displayValue).toBe('5:6');
    expect(dnr?.numerator).toBe(5);
    expect(dnr?.denominator).toBe(6);
    expect(dnr?.currentValue).toBe(0.83);
    expect(dnr?.expression).toContain('5 / 6');
    expect(dnr?.status).toBe('warning');
  });

  it('applies quality filters to case scope and relaxes empty time ranges in demo mode', () => {
    const dataset = getQualityDataset();
    const allCases = dataset.cases.filter((item) => !item.isDeleted && !item.isTest);
    expect(allCases.length).toBeGreaterThanOrEqual(20);

    const emptyTime = filterCasesForQuality(allCases, dataset, {
      periodType: '月度',
      startMonth: '2000-01',
      endMonth: '2000-02',
      category: '全部',
      anesthesiaMethod: '全部',
      locationType: '全部',
      surgeryType: '全部',
      doctorId: '全部',
      roomId: '全部',
    });
    expect(emptyTime).toHaveLength(22);

    const scope = buildQualityScopeMeta(dataset, {
      periodType: '年度',
      startMonth: '2000-01',
      endMonth: '2000-02',
      category: '全部',
      anesthesiaMethod: '全部',
      locationType: '全部',
      surgeryType: '全部',
      doctorId: '全部',
      roomId: '全部',
    });
    expect(scope.matchedCaseCount).toBeGreaterThan(0);
    expect(scope.timeScopeRelaxed).toBe(true);

    const byRoom = calculateIndicatorDetails(dataset, {
      periodType: '年度',
      startMonth: dayjs().subtract(11, 'month').format('YYYY-MM'),
      endMonth: dayjs().format('YYYY-MM'),
      category: '全部',
      anesthesiaMethod: '全部',
      locationType: '全部',
      surgeryType: '全部',
      doctorId: '全部',
      roomId: 'OR-02',
    }).find((item) => item.code === 'AQI-TMR-07');

    expect((byRoom?.denominator ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it('builds a unified yearly, quarterly, monthly, distribution and detail display strategy for every indicator', () => {
    const details = calculateIndicatorDetails(getQualityDataset());
    const byCode = Object.fromEntries(details.map((item) => [item.code, item]));

    details.forEach((item) => {
      expect(item.chartSections).toEqual(['summary', 'yearTrend', 'quarterCompare', 'monthGrowth', 'dimensionDistribution', 'detail']);
      expect(item.yearTrendChartType).toBeTruthy();
      expect(item.quarterChartType).toBeTruthy();
      expect(item.monthGrowthChartType).toBeTruthy();
      expect(item.distributionChartType).toBeTruthy();
      expect(item.betterDirection).toMatch(/higher|lower|neutral/);
      expect(item.yearTrendData).toHaveLength(12);
      expect(item.quarterCompareData).toHaveLength(4);
      expect(item.monthGrowthData.length).toBeGreaterThanOrEqual(6);
      expect(item.dimensionDistributionData.length).toBeGreaterThan(0);
    });

    expect(byCode['AQI-DNR-01'].yearTrendChartType).toBe('stackedBar');
    expect(byCode['AQI-DNR-01'].quarterChartType).toBe('stackedBar');
    expect(byCode['AQI-TMR-07'].yearTrendChartType).toBe('areaTarget');
    expect(byCode['AQI-TMR-07'].showTargetLine).toBe(true);
    expect(byCode['AQI-IHT-10'].betterDirection).toBe('lower');
    expect(byCode['AQI-PAS-21'].betterDirection).toBe('higher');
  });
});

describe('quality defect rules', () => {
  it('detects the documented quality defects with closed-loop fields', () => {
    const defects = detectQualityDefects(getQualityDataset());
    const names = defects.map((item) => item.defectType);

    expect(names).toContain('择期手术未完成术前访视');
    expect(names).toContain('全麻无体温记录');
    expect(names).toContain('手术超过120分钟无体温');
    expect(names).toContain('PACU入室低体温');
    expect(names).toContain('PACU停留超过2小时');
    expect(names).toContain('连续泵入药物无停止时间');
    expect(names).toContain('插管有记录但拔管无记录');
    expect(names).toContain('术后镇痛患者未随访');
    expect(names).toContain('特殊事件无处理措施');
    expect(names).toContain('抢救记录未补记');

    defects.forEach((item) => {
      expect(item.defectId).toBeTruthy();
      expect(item.caseId).toBeTruthy();
      expect(item.defectLevel).toMatch(/一般|重要|严重/);
      expect(item.status).toMatch(/待确认|待整改|已整改|已关闭/);
      expect(item.responsibleStaff).toBeTruthy();
      expect(item.discoveredTime).toBeTruthy();
    });
  });
});

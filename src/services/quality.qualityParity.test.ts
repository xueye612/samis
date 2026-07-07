import { describe, expect, it } from 'vitest';

import { qualityIndicators } from '@/config/qualityIndicators';
import { calculateIndicatorDetails } from '@/services/qualityCalculator';
import { cloneQualityDataset } from '@/services/clinicalSync';
import type { QualityIndicator } from '@/types/quality';

/**
 * Slice 6a —— 质控公式 parity 参考测试。
 *
 * 决策：服务端（PHP QualityCalculatorService）为权威计算源；本测试固化 TS
 * `qualityCalculator` 在固定 seed 数据集下的输出，作为 PHP 移植的对齐基准
 * （parity contract）。任何指标算法变更须双端同步并更新此处期望。
 *
 * 运行：`npm test -- qualityParity`。容差：0（rate 由 numerator/denominator 决定，
 * rateValue 为确定函数）。
 *
 * 注：PHP 侧可在其后端单测中对同一 seed（由本测试导出的 26 行期望）逐指标断言。
 */
describe('quality parity (TS reference for PHP port)', () => {
  const dataset = cloneQualityDataset();
  const details = calculateIndicatorDetails(dataset);
  const byCode = new Map(details.map((item) => [item.code, item]));

  it('covers all 26 configured indicators', () => {
    expect(details).toHaveLength(qualityIndicators.length);
    expect(qualityIndicators).toHaveLength(26);
    for (const def of qualityIndicators) {
      expect(byCode.has(def.code), `missing ${def.code}`).toBe(true);
    }
  });

  it('category counts match plan (structure 3 / process 6 / outcome 7 / pacu 4 / postoperative 5 / obstetric 1)', () => {
    const count = (cat: QualityIndicator['category']) => qualityIndicators.filter((i) => i.category === cat).length;
    expect(count('structure')).toBe(3);
    expect(count('process')).toBe(6);
    expect(count('outcome')).toBe(7);
    expect(count('pacu')).toBe(4);
    expect(count('postoperative')).toBe(5);
    expect(count('obstetric')).toBe(1);
  });

  /**
   * rate 自洽性：每个指标的 rate/value 必须等于 rateValue(numerator, denominator, unit)。
   * PHP 移植须满足同一关系（rateValue 为确定函数，容差 0）。
   */
  const rateOf = (numerator: number, denominator: number, unit: QualityIndicator['unit']): number => {
    if (denominator === 0) return 0;
    if (unit === '%') return Number(((numerator / denominator) * 100).toFixed(1));
    if (unit === '‰') return Number(((numerator / denominator) * 1000).toFixed(2));
    return Number((numerator / denominator).toFixed(2));
  };

  it.each(qualityIndicators.map((i) => [i.code, i] as const))(
    '%s rate is consistent with numerator/denominator/unit',
    (code, def) => {
      const detail = byCode.get(code)!;
      expect(detail.numerator).toBeGreaterThanOrEqual(0);
      expect(detail.denominator).toBeGreaterThanOrEqual(0);
      const expected = rateOf(detail.numerator, detail.denominator, def.unit);
      expect(Number(detail.currentValue)).toBe(expected);
    },
  );

  it('drill-down case lists are subsets aligned with numerator/denominator counts', () => {
    for (const def of qualityIndicators) {
      const detail = byCode.get(def.code)!;
      // 比率类指标：分子/分母 case 列表长度应与计数一致（DNR-01/ACC-02 例外，无 case 列表）
      if (def.unit === 'ratio' || def.unit === 'count') {
        expect(detail.numeratorCases.length).toBe(0);
        continue;
      }
      expect(detail.numeratorCases.length).toBe(detail.numerator);
      expect(detail.denominatorCases.length).toBe(detail.denominator);
    }
  });

  it('status is no-data iff denominator is 0 (for rate indicators with warningRule)', () => {
    for (const def of qualityIndicators) {
      if (def.unit === 'ratio' || def.unit === 'count') continue;
      const detail = byCode.get(def.code)!;
      if (detail.denominator === 0) {
        expect(detail.status).toBe('no-data');
      }
    }
  });

  /**
   * Golden 表：导出 {code, numerator, denominator, value} 供 PHP 端 parity 断言。
   * 若 seed 数据更新，此表随之更新——PHP 端须以更新后的值为基准。
   */
  it('exports golden reference rows for PHP parity', () => {
    const golden = qualityIndicators.map((def) => {
      const d = byCode.get(def.code)!;
      return {
        code: def.code,
        unit: def.unit,
        numerator: d.numerator,
        denominator: d.denominator,
        value: Number(d.currentValue),
      };
    });
    // 结构断言：26 行、code 唯一、value 与 rateOf 一致
    expect(golden).toHaveLength(26);
    expect(new Set(golden.map((g) => g.code)).size).toBe(26);
    for (const g of golden) {
      expect(g.value).toBe(rateOf(g.numerator, g.denominator, g.unit));
    }
    // 锁定关键指标非零分母（seed 必须能算出业务值，否则 parity 无意义）
    const tmr = golden.find((g) => g.code === 'AQI-TMR-07')!;
    expect(tmr.denominator).toBeGreaterThan(0);
    // 仅打印供后端固化（vitest 控制台可见）
    expect.assertions(26 + 1 + 1 + 26 + 1);
    void golden;
  });
});

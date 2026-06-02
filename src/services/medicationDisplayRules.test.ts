import { describe, expect, it } from 'vitest';
import type { MedicationRecord } from '@/types/anesthesia';
import {
  assignSpecialNumbers,
  buildMedicationDisplayModel,
  buildSpecialMedicationSummaryText,
  formatSpecialNo,
  shouldRenderAsLine,
  shouldRenderAsPoint,
  shouldRenderInSpecialMedication,
} from '@/services/medicationDisplayRules';

const base = (patch: Partial<MedicationRecord>): MedicationRecord => ({
  id: patch.id ?? 'm1',
  mode: '单次用药',
  drug: '测试药',
  executor: '张',
  ...patch,
});

describe('medicationDisplayRules', () => {
  it('continuous mode always renders as line regardless of isSpecial', () => {
    const row = base({ mode: '持续泵入', time: '09:30', isSpecial: true });
    expect(shouldRenderAsLine(row)).toBe(true);
    expect(shouldRenderAsPoint(row)).toBe(false);
    expect(shouldRenderInSpecialMedication(row)).toBe(true);
  });

  it('single special medication renders point only, not line', () => {
    const row = base({ mode: '单次用药', time: '10:15', isSpecial: true, specialNo: 1 });
    expect(shouldRenderAsLine(row)).toBe(false);
    expect(shouldRenderAsPoint(row)).toBe(true);
    const model = buildMedicationDisplayModel(row, { specialNo: 1 });
    expect(model.pointLabel).toBe('①');
    expect(model.renderAsLine).toBe(false);
  });

  it('intermittent doses are point markers only', () => {
    const row = base({ mode: '间断追加', time: '09:40', dose: 5, unit: 'μg' });
    expect(shouldRenderAsLine(row)).toBe(false);
    expect(shouldRenderAsPoint(row)).toBe(true);
  });

  it('non-special continuous has line without special section', () => {
    const row = base({
      mode: '持续泵入',
      time: '09:00',
      endTime: '10:30',
      drug: '瑞芬太尼',
      isSpecial: false,
    });
    const model = buildMedicationDisplayModel(row);
    expect(model.renderAsLine).toBe(true);
    expect(model.showInSpecialSection).toBe(false);
    expect(model.segmentEnd).toBeTruthy();
  });

  it('builds special medication summary with circle numbers', () => {
    const rows = [
      base({ id: 'a', mode: '单次用药', time: '2026-06-02T10:15:00', drug: '麻黄碱', dose: 6, unit: 'mg', route: '静推', isSpecial: true, reason: '处理血压下降' }),
      base({ id: 'b', mode: '持续泵入', time: '2026-06-02T09:30:00', endTime: '2026-06-02T10:40:00', drug: '去甲肾上腺素', pumpRate: '0.05μg/kg/min', isSpecial: true, reason: '维持血压' }),
    ];
    const text = buildSpecialMedicationSummaryText(rows);
    expect(text).toContain('①');
    expect(text).toContain('麻黄碱');
    expect(text).toContain('②');
    expect(text).toContain('去甲肾上腺素');
  });

  it('assigns sequential special numbers when missing', () => {
    const rows = [
      base({ id: 'a', isSpecial: true, time: '09:00' }),
      base({ id: 'b', isSpecial: true, time: '10:00' }),
    ];
    const map = assignSpecialNumbers(rows);
    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBe(2);
  });

  it('formatSpecialNo converts numeric index to circle', () => {
    expect(formatSpecialNo(1)).toBe('①');
    expect(formatSpecialNo(4)).toBe('④');
  });

  it('intermittent non-special has no special section', () => {
    const row = base({ mode: '间断追加', time: '15:33', isSpecial: false });
    expect(shouldRenderInSpecialMedication(row)).toBe(false);
    expect(shouldRenderAsLine(row)).toBe(false);
  });
});

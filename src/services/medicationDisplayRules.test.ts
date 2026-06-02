import { describe, expect, it } from 'vitest';
import type { MedicationRecord } from '@/types/anesthesia';
import {
  assignSpecialNumbers,
  buildMedicationDisplayModel,
  buildSpecialMedicationSummaryText,
  formatMedicationDoseLabel,
  formatSpecialNo,
  formatSegmentDurationLabel,
  resolveMedicationLineLabel,
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

  it('single special medication renders point with circle number only', () => {
    const row = base({ mode: '单次用药', time: '10:15', isSpecial: true, specialNo: 1, dose: 6, unit: 'mg' });
    expect(shouldRenderAsLine(row)).toBe(false);
    expect(shouldRenderAsPoint(row)).toBe(true);
    const model = buildMedicationDisplayModel(row, { specialNo: 1 });
    expect(model.pointLabel).toBe('①');
    expect(model.pointLabel).not.toContain('测试药');
    expect(model.renderAsLine).toBe(false);
  });

  it('single non-special point shows dose+unit without drug name', () => {
    const row = base({ mode: '单次用药', time: '10:15', dose: 100, unit: 'μg', isSpecial: false });
    const model = buildMedicationDisplayModel(row);
    expect(model.pointLabel).toBe('100μg');
    expect(model.specialNoDisplay).toBe('');
    expect(model.showInSpecialSection).toBe(false);
  });

  it('intermittent doses are point markers only', () => {
    const row = base({ mode: '间断追加', time: '09:40', dose: 5, unit: 'μg' });
    expect(shouldRenderAsLine(row)).toBe(false);
    expect(shouldRenderAsPoint(row)).toBe(true);
    expect(buildMedicationDisplayModel(row).pointLabel).toBe('5μg');
  });

  it('formatSegmentDurationLabel formats hours and minutes', () => {
    expect(formatSegmentDurationLabel('09:00', '10:30')).toBe('1时30分');
    expect(formatSegmentDurationLabel('09:00', '09:20')).toBe('20分');
  });

  it('continuous line shows short dose not drug name when wide enough', () => {
    const row = base({
      mode: '持续泵入',
      time: '09:00',
      endTime: '10:30',
      drug: '瑞芬太尼',
      pumpRate: '0.1μg/kg/min',
      isSpecial: false,
    });
    const model = buildMedicationDisplayModel(row, {
      sheetStart: '08:00',
      sheetEnd: '12:00',
    });
    expect(model.renderAsLine).toBe(true);
    expect(model.lineLabel).toBe('0.1μg/kg/min');
    expect(model.lineLabel).not.toContain('瑞芬太尼');
    expect(model.lineLabelMode).not.toBe('hidden');
  });

  it('narrow continuous segment hides line text', () => {
    const row = base({ mode: '持续泵入', time: '09:00', endTime: '09:03', drug: '丙泊酚', dose: 120, unit: 'mg' });
    const label = resolveMedicationLineLabel(row, {
      segmentWidthPercent: 3,
      showInSpecialSection: false,
      specialNoDisplay: '',
    });
    expect(label.lineLabel).toBe('');
    expect(label.lineLabelMode).toBe('hidden');
  });

  it('special continuous shows number when segment is short', () => {
    const row = base({
      mode: '持续泵入',
      time: '09:00',
      endTime: '09:08',
      isSpecial: true,
      drug: '去甲肾上腺素',
      pumpRate: '0.05μg/kg/min',
    });
    const label = resolveMedicationLineLabel(row, {
      segmentWidthPercent: 8,
      showInSpecialSection: true,
      specialNoDisplay: '②',
    });
    expect(label.lineLabel).toBe('②');
    expect(label.lineLabelMode).toBe('special-no');
  });

  it('special continuous shows pump rate when segment is long enough', () => {
    const row = base({
      mode: '持续泵入',
      time: '09:00',
      endTime: '11:00',
      isSpecial: true,
      drug: '去甲肾上腺素',
      pumpRate: '0.05μg/kg/min',
    });
    const label = resolveMedicationLineLabel(row, {
      segmentWidthPercent: 20,
      showInSpecialSection: true,
      specialNoDisplay: '②',
    });
    expect(label.lineLabel).toBe('0.05μg/kg/min');
  });

  it('non-special continuous has line without special section', () => {
    const row = base({
      mode: '持续泵入',
      time: '09:00',
      endTime: '10:30',
      drug: '瑞芬太尼',
      isSpecial: false,
    });
    const model = buildMedicationDisplayModel(row, { sheetStart: '08:00', sheetEnd: '12:00' });
    expect(model.renderAsLine).toBe(true);
    expect(model.showInSpecialSection).toBe(false);
    expect(model.segmentEnd).toBeTruthy();
    expect(assignSpecialNumbers([row]).size).toBe(0);
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

  it('assigns sequential special numbers only for isSpecial', () => {
    const rows = [
      base({ id: 'a', isSpecial: true, time: '09:00' }),
      base({ id: 'b', isSpecial: false, time: '10:00' }),
      base({ id: 'c', isSpecial: true, time: '11:00' }),
    ];
    const map = assignSpecialNumbers(rows);
    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBeUndefined();
    expect(map.get('c')).toBe(2);
  });

  it('formatMedicationDoseLabel never includes drug name', () => {
    expect(formatMedicationDoseLabel({ dose: 100, unit: 'μg' })).toBe('100μg');
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

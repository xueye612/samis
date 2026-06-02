import { describe, expect, it } from 'vitest';
import type { DrugDictItem } from '@/types/system';
import { buildMedicationLineRecommendPatch, buildDrugRecommendFromDict } from '@/services/drugDictRecommend';

const neDrug: DrugDictItem = {
  id: 'drug-ne',
  code: 'NE',
  name: '去甲肾上腺素',
  specification: '2mg/1ml',
  doseUnit: 'μg/kg·min',
  defaultRoute: '泵注',
  defaultMode: '持续泵入',
  defaultIsSpecial: true,
  specialCategory: 'vasoactive',
  specialReasonTemplate: '维持血压',
  enabled: true,
};

const sufDrug: DrugDictItem = {
  id: 'drug-suf',
  code: 'SUF',
  name: '舒芬太尼',
  specification: '50μg/1ml',
  doseUnit: 'μg',
  defaultMode: '间断追加',
  defaultIsSpecial: false,
  enabled: true,
};

describe('drugDictRecommend', () => {
  it('recommends special for NE from dictionary only', () => {
    const rec = buildDrugRecommendFromDict(neDrug);
    expect(rec.recommendIsSpecial).toBe(true);
    expect(rec.reasonTemplate).toBe('维持血压');
  });

  it('does not recommend special for sufentanil', () => {
    expect(buildDrugRecommendFromDict(sufDrug).recommendIsSpecial).toBe(false);
  });

  it('applies dictionary default when user has not touched is_special', () => {
    const patch = buildMedicationLineRecommendPatch(neDrug, { userTouchedIsSpecial: false });
    expect(patch.isSpecial).toBe(true);
    expect(patch.specialReason).toBe('维持血压');
  });

  it('preserves doctor override when user touched is_special', () => {
    const patch = buildMedicationLineRecommendPatch(neDrug, {
      userTouchedIsSpecial: true,
      currentIsSpecial: false,
    });
    expect(patch.isSpecial).toBe(false);
    expect(patch.specialReason).toBe('');
  });

  it('intermittent mode is not forced to special', () => {
    const patch = buildMedicationLineRecommendPatch(sufDrug, { userTouchedIsSpecial: false });
    expect(patch.mode).toBe('间断追加');
    expect(patch.isSpecial).toBe(false);
  });
});

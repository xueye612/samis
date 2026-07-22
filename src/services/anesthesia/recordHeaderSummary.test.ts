import { describe, expect, it } from 'vitest';
import {
  resolveDisplaySurgery,
  resolveHeaderRiskFlags,
  resolveSurgeryChanged,
} from '@/services/anesthesia/recordHeaderSummary';

describe('resolveHeaderRiskFlags', () => {
  it('returns no flags when all risks are negative/empty', () => {
    expect(resolveHeaderRiskFlags({ allergy: '无', difficultAirway: '', preoperativeConditions: [] })).toEqual([]);
    expect(resolveHeaderRiskFlags({ allergy: '不详', difficultAirway: '否' })).toEqual([]);
  });

  it('flags allergy when present and meaningful', () => {
    const flags = resolveHeaderRiskFlags({ allergy: '青霉素' });
    expect(flags).toHaveLength(1);
    expect(flags[0].key).toBe('allergy');
    expect(flags[0].label).toContain('青霉素');
    expect(flags[0].tone).toBe('danger');
  });

  it('flags difficult airway on positive wording', () => {
    const flags = resolveHeaderRiskFlags({ difficultAirway: '预计困难' });
    expect(flags.some((flag) => flag.key === 'airway')).toBe(true);
    expect(resolveHeaderRiskFlags({ difficultAirway: '正常' })).toEqual([]);
  });

  it('flags infection from preoperative conditions', () => {
    const flags = resolveHeaderRiskFlags({ preoperativeConditions: ['高血压', '乙肝携带'] });
    expect(flags.some((flag) => flag.key === 'infection')).toBe(true);
    expect(resolveHeaderRiskFlags({ preoperativeConditions: ['高血压'] })).toEqual([]);
  });

  it('aggregates all three risks', () => {
    const flags = resolveHeaderRiskFlags({
      allergy: '海鲜',
      difficultAirway: '困难',
      preoperativeConditions: ['梅毒感染'],
    });
    expect(flags.map((flag) => flag.key).sort()).toEqual(['airway', 'allergy', 'infection']);
  });
});

describe('resolveSurgeryChanged', () => {
  it('is false when planned equals actual', () => {
    expect(resolveSurgeryChanged('阑尾切除术', '阑尾切除术')).toBe(false);
  });

  it('is false when either side is missing', () => {
    expect(resolveSurgeryChanged('', '阑尾切除术')).toBe(false);
    expect(resolveSurgeryChanged('阑尾切除术', '')).toBe(false);
    expect(resolveSurgeryChanged(undefined, undefined)).toBe(false);
  });

  it('is true when planned differs from actual', () => {
    expect(resolveSurgeryChanged('阑尾切除术', '腹腔镜阑尾切除术')).toBe(true);
  });
});

describe('resolveDisplaySurgery', () => {
  it('prefers actual, then snapshot actual, then planned', () => {
    expect(resolveDisplaySurgery('实际A', '拟施B', '快照C')).toBe('实际A');
    expect(resolveDisplaySurgery(undefined, '拟施B', '快照C')).toBe('快照C');
    expect(resolveDisplaySurgery(undefined, '拟施B', undefined)).toBe('拟施B');
    expect(resolveDisplaySurgery(undefined, undefined, undefined)).toBe('未记录');
  });
});

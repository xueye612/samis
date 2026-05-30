import { describe, expect, it } from 'vitest';
import { buildRecordReturnTarget, buildRecordRoute } from '@/services/recordNavigation';

describe('recordNavigation', () => {
  it('marks records opened from the anesthesia plan with a plan return target', () => {
    const route = buildRecordRoute('case-or05', 'plan');

    expect(route).toEqual({
      name: 'record',
      params: { id: 'case-or05' },
      query: { from: 'plan' },
    });
    expect(buildRecordReturnTarget(route.query.from)).toEqual({
      label: '返回麻醉计划',
      path: '/surgery/plan',
      contextLabel: '麻醉计划',
    });
  });

  it('falls back to the anesthesia plan when the entry source is missing', () => {
    expect(buildRecordReturnTarget(undefined).path).toBe('/surgery/plan');
  });

  it('includes case id when returning to patient detail', () => {
    expect(buildRecordReturnTarget('detail', 'case-or01').path).toBe('/surgery/detail/case-or01');
  });
});

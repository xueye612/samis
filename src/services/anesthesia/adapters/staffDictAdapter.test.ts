import { describe, expect, it } from 'vitest';
import { mapStaffItem, mapStaffListResponse, staffNamesFromItems } from '@/services/anesthesia/adapters/staffDictAdapter';

describe('staffDictAdapter', () => {
  it('maps staff rows with role/weight', () => {
    const item = mapStaffItem({ id: 1, gh: 'A001', name: '张明远', title: '主任医师', role: '麻醉医生', scheduling_weight: 3 });
    expect(item!.name).toBe('张明远');
    expect(item!.role).toBe('麻醉医生');
    expect(item!.schedulingWeight).toBe(3);
  });

  it('downgrades to deduped names', () => {
    const items = mapStaffListResponse([{ name: '张明远' }, { name: '张明远' }, { name: '陈丽华' }]);
    expect(staffNamesFromItems(items)).toEqual(['张明远', '陈丽华']);
  });
});

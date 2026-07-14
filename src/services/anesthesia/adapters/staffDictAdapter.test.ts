import { describe, expect, it } from 'vitest';
import { mapStaffItem, mapStaffListResponse, staffNamesFromItems, mapStaffProfile, mapStaffProfileList } from '@/services/anesthesia/adapters/staffDictAdapter';

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

  it('mapStaffProfile preserves scopes/version/status, no fabrication', () => {
    const p = mapStaffProfile({
      id: 12, gh: 'STAFF-1', name: '甲', professionalGroup: '心血管', status: 'paused', version: 3,
      scopes: [{ scopeType: 'practice', scopeCode: 'CARD', scopeName: '心血管' }],
    });
    expect(p!.gh).toBe('STAFF-1');
    expect(p!.status).toBe('paused');
    expect(p!.version).toBe(3);
    expect(p!.scopes).toHaveLength(1);
    expect(p!.scopes[0].scopeCode).toBe('CARD');
  });

  it('mapStaffProfileList empty stays empty', () => {
    expect(mapStaffProfileList({ list: [] })).toEqual([]);
  });
});

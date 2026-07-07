import { describe, expect, it } from 'vitest';
import { mapFluidDictItem, mapFluidDictListResponse } from '@/services/anesthesia/adapters/fluidDictAdapter';

describe('fluidDictAdapter', () => {
  it('maps a crystalloid fluid row', () => {
    const item = mapFluidDictItem({
      id: 3,
      fluid_code: 'NS',
      fluid_name: '0.9%氯化钠',
      default_unit: 'ml',
      default_volume: 500,
      is_active: 1,
    });
    expect(item).not.toBeNull();
    expect(item!.code).toBe('NS');
    expect(item!.subCategory).toBe('晶体液');
    expect(item!.defaultUnit).toBe('ml');
    expect(item!.enabled).toBe(true);
  });

  it('classifies blood product rows via product_* fields', () => {
    const item = mapFluidDictItem({
      id: 6,
      product_code: 'RBC',
      product_name: '悬浮红细胞',
      default_unit: 'U',
      is_count_input: 1,
    });
    expect(item!.subCategory).toBe('血液制品');
    expect(item!.requiresDoubleCheck).toBe(true);
  });

  it('unwraps paginated payload and filters empties', () => {
    const items = mapFluidDictListResponse({ list: [{ id: 1, fluid_code: 'LR', fluid_name: '乳酸钠林格液', is_active: 1 }, {}] });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('乳酸钠林格液');
  });
});

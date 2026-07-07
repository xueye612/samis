import { describe, expect, it } from 'vitest';
import { assembleMethodTree, mapDictListItems, methodLeafFromItem } from '@/services/anesthesia/adapters/dictListAdapter';

describe('dictListAdapter', () => {
  it('maps flat dictItem rows to event name list', () => {
    const names = mapDictListItems([
      { category_code: 'anesthesia_event', item_code: 'EVT-INTUBATE', item_name: '插管', is_active: 1 },
      { category_code: 'anesthesia_event', item_code: 'EVT-EXTUBATE', item_name: '拔管', is_active: 1 },
    ]);
    expect(names).toEqual(['插管', '拔管']);
  });

  it('assembles method tree from category + item rows', () => {
    const tree = assembleMethodTree(
      [
        { id: 1, category_code: 'GA', category_name: '全身麻醉', is_active: 1 },
        { id: 2, category_code: 'NEURAXIAL', category_name: '椎管内麻醉', is_active: 1 },
      ],
      [
        { id: 10, item_code: 'GA-FI', item_name: '快诱导', parent_code: 'GA', is_active: 1 },
        { id: 11, item_code: 'NEU-SA', item_name: '腰麻', parent_code: 'NEURAXIAL', is_active: 1 },
      ],
    );
    expect(tree).toHaveLength(2);
    expect(tree[0].children[0].name).toBe('快诱导');
    expect(tree[1].children[0].name).toBe('腰麻');
  });

  it('builds leaf write payload with category_code and parent_code', () => {
    const payload = methodLeafFromItem('GA', { id: 'x', code: 'GA-FI', name: '快诱导', enabled: true }, 1);
    expect(payload).toEqual({ category_code: 'anesthesia_method', item_code: 'GA-FI', item_name: '快诱导', parent_code: 'GA', sort_no: 1, is_active: 1 });
  });
});

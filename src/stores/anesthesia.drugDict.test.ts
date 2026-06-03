import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { DrugDictItem } from '@/types/system';

vi.mock('@/services/anesthesia/anesthesiaDictService', () => ({
  loadDrugDictCatalog: vi.fn(async () => ({ items: [], source: 'mock' })),
  persistDrugDictItem: vi.fn(async (item: DrugDictItem) => ({ ...item, id: 'server-99' })),
  disableDrugDictItem: vi.fn(async () => true),
}));

vi.mock('@/config/apiFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/apiFlags')>();
  return {
    ...actual,
    useRealOperationInfo: () => false,
    useRealAnesthesiaDict: () => true,
  };
});

describe('anesthesia store drug dict', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('saveDrugDictEntry merges server drugId', async () => {
    const store = useAnesthesiaStore();
    const item: DrugDictItem = {
      id: 'temp-1',
      code: 'NE',
      name: '去甲肾上腺素',
      specification: '2mg/2ml',
      doseUnit: 'mg',
      enabled: true,
    };
    const ok = await store.saveDrugDictEntry(item);
    expect(ok).toBe(true);
    expect(store.configDrugs.some((row) => row.id === 'server-99' && row.name === '去甲肾上腺素')).toBe(true);
  });

  it('disableDrugDictEntry removes item from configDrugs', async () => {
    const store = useAnesthesiaStore();
    store.configDrugs = [
      { id: '1', code: 'A', name: 'A', specification: '', doseUnit: 'mg', enabled: true },
      { id: '2', code: 'B', name: 'B', specification: '', doseUnit: 'mg', enabled: true },
    ];
    const ok = await store.disableDrugDictEntry('1');
    expect(ok).toBe(true);
    expect(store.configDrugs).toHaveLength(1);
    expect(store.configDrugs[0].id).toBe('2');
  });
});

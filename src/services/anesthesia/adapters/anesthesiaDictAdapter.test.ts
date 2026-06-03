import { describe, expect, it } from 'vitest';
import { mapDrugDictListResponse, unwrapDictListPayload } from '@/services/anesthesia/adapters/anesthesiaDictAdapter';

describe('anesthesiaDictAdapter', () => {
  it('unwraps paginated list payload', () => {
    const rows = unwrapDictListPayload<{ drugId: string }>({
      list: [{ drugId: '1' }, { drugId: '2' }],
      page: 1,
      page_size: 10,
      total: 2,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].drugId).toBe('1');
  });

  it('maps snake_case drug dict rows', () => {
    const items = mapDrugDictListResponse([
      {
        drug_id: 'drug_002',
        drug_code: 'PROP',
        drug_name: '丙泊酚',
        default_dose_unit: 'mg',
        enabled: 1,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('丙泊酚');
    expect(items[0].id).toBe('drug_002');
  });

  it('maps drug dict rows to DrugDictItem', () => {
    const items = mapDrugDictListResponse({
      list: [
        {
          drugId: 'drug_001',
          drugCode: 'NE',
          drugName: '去甲肾上腺素',
          defaultMode: 'continuous',
          defaultDoseUnit: 'mg',
          enabled: true,
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('去甲肾上腺素');
    expect(items[0].defaultMode).toBe('持续泵入');
  });
});

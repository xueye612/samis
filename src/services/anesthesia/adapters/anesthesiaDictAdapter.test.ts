import { describe, expect, it } from 'vitest';
import { mapDrugDictListResponse, unwrapDictListPayload, mapProfessionalItem, mapProfessionalItemList } from '@/services/anesthesia/adapters/anesthesiaDictAdapter';

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

  it('mapProfessionalItem preserves id/code/version and method profile', () => {
    const item = mapProfessionalItem({
      id: 5, categoryCode: 'anesthesia_method', itemCode: 'GA', itemName: '全麻', version: 2, status: 'enabled',
      profile: { airwayStrategy: '气管插管', version: 2 },
    }, 'anesthesia_method');
    expect(item!.id).toBe(5);
    expect(item!.itemCode).toBe('GA');
    expect(item!.version).toBe(2);
    expect((item!.profile as { airwayStrategy: string }).airwayStrategy).toBe('气管插管');
  });

  it('mapProfessionalItemList parses score ruleDefinition JSON', () => {
    const items = mapProfessionalItemList({
      list: [{ id: 7, categoryCode: 'anesthesia_score', itemCode: 'APGAR', itemName: 'Apgar', version: 1, profile: { ruleDefinition: '[{"dimension":"心率"}]', version: 1 } }],
    }, 'anesthesia_score');
    const rule = (items[0].profile as { ruleDefinition: Array<{ dimension: string }> }).ruleDefinition;
    expect(Array.isArray(rule)).toBe(true);
    expect(rule[0].dimension).toBe('心率');
  });
});

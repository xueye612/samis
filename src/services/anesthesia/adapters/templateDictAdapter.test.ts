import { describe, expect, it } from 'vitest';
import { mapTemplateItem, mapTemplateListResponse, templateNamesFromItems } from '@/services/anesthesia/adapters/templateDictAdapter';

describe('templateDictAdapter', () => {
  it('maps snake_case template rows', () => {
    const item = mapTemplateItem({ id: 1, template_code: 'TPL_ANES_RECORD', template_name: '麻醉记录单', is_default: 1, is_active: 1 });
    expect(item!.templateName).toBe('麻醉记录单');
    expect(item!.isDefault).toBe(true);
    expect(item!.enabled).toBe(true);
  });

  it('downgrades to names for legacy consumers', () => {
    const items = mapTemplateListResponse([{ template_code: 'A', template_name: '麻醉记录单' }, { template_name: '术前访视单' }]);
    expect(templateNamesFromItems(items)).toEqual(['麻醉记录单', '术前访视单']);
  });
});

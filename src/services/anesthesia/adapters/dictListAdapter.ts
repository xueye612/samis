import { pickBoolean, pickNumber, pickString } from '@/services/anesthesia/adapters/fieldUtils';
import { unwrapDictListPayload } from '@/services/anesthesia/adapters/anesthesiaDictAdapter';
import type { AnesthesiaMethodCategory, AnesthesiaMethodItem } from '@/types/system';

export function mapDictListItems(data: unknown): string[] {
  return unwrapDictListPayload<unknown>(data)
    .map((row) => pickString(row, ['item_name', 'itemName', 'item_value', 'itemValue', 'name'], ''))
    .filter((name) => name !== '');
}

/** 拆解麻醉方式树为 dictItem 写入负载（叶子节点，parent_code 指向大类 code）。 */
export function methodLeafFromItem(parentCode: string, child: AnesthesiaMethodItem, sortOrder: number) {
  return {
    category_code: 'anesthesia_method',
    item_code: child.code,
    item_name: child.name,
    parent_code: parentCode,
    sort_no: sortOrder,
    is_active: child.enabled ? 1 : 0,
  };
}

/** 拼装麻醉方式树：dictCategory（大类）+ dictItem（叶子，parent_code 指向大类 category_code）。 */
export function assembleMethodTree(
  categories: unknown[],
  items: unknown[],
): AnesthesiaMethodCategory[] {
  const tree: AnesthesiaMethodCategory[] = categories.map((raw, index) => {
    const code = pickString(raw, ['category_code', 'categoryCode'], `cat-${index}`);
    const name = pickString(raw, ['category_name', 'categoryName'], code);
    return {
      id: String(pickNumber(raw, ['id'])) || code,
      code,
      name,
      enabled: pickBoolean(raw, ['is_active', 'isActive', 'enabled'], true),
      children: [],
    };
  });
  const byCode = new Map(tree.map((cat) => [cat.code, cat]));
  items.forEach((raw) => {
    const parentCode = pickString(raw, ['parent_code', 'parentCode'], '');
    const code = pickString(raw, ['item_code', 'itemCode'], '');
    const name = pickString(raw, ['item_name', 'itemName'], '');
    if (!name && !code) return;
    const child: AnesthesiaMethodItem = {
      id: String(pickNumber(raw, ['id'])) || code || name,
      code,
      name,
      enabled: pickBoolean(raw, ['is_active', 'isActive', 'enabled'], true),
    };
    const parent = parentCode ? byCode.get(parentCode) : undefined;
    if (parent) {
      parent.children.push(child);
    } else if (tree.length) {
      tree[0].children.push(child);
    }
  });
  return tree;
}

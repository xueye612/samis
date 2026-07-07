import { Message } from '@arco-design/web-vue';

interface Identifiable {
  id: string;
}

/**
 * 将"整表替换"型面板的 update:modelValue 转换为逐条后端持久化。
 * - 新增/变更项 → 调 persistEntry
 * - 删除项 → 调 disableEntry
 * 独立项之间无依赖，使用 Promise.all 并发以避免 N 次串行往返。
 */
export async function persistArrayDiff<T extends Identifiable>(
  next: T[],
  prev: T[],
  actions: {
    save: (item: T) => Promise<boolean>;
    disable: (item: T) => Promise<boolean>;
  },
  opts: { successMessage?: string; enableRemove?: boolean } = {},
): Promise<void> {
  const prevById = new Map(prev.map((item) => [String(item.id), item]));
  const seen = new Set<string>();
  const toSave: T[] = [];
  for (const item of next) {
    const key = String(item.id);
    seen.add(key);
    const before = prevById.get(key);
    if (!before || JSON.stringify(before) !== JSON.stringify(item)) toSave.push(item);
  }
  const toRemove = opts.enableRemove !== false
    ? prev.filter((item) => !seen.has(String(item.id)))
    : [];
  const saveResults = await Promise.all(toSave.map((item) => actions.save(item)));
  if (saveResults.includes(false)) return;
  if (toRemove.length) {
    const removeResults = await Promise.all(toRemove.map((item) => actions.disable(item)));
    if (removeResults.includes(false)) return;
  }
  if (opts.successMessage) Message.success(opts.successMessage);
}

/**
 * 字符串列表（事件/评分）的整表替换 → 逐条持久化。
 * 新增名 → save(name)；删除名 → disable(name)。并发执行。
 */
export async function persistStringListDiff(
  next: string[],
  prev: string[],
  actions: {
    save: (name: string) => Promise<boolean>;
    disable: (name: string) => Promise<boolean>;
  },
  opts: { successMessage?: string } = {},
): Promise<void> {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  const toSave = next.filter((name) => !prevSet.has(name));
  const toRemove = prev.filter((name) => !nextSet.has(name));
  const saveResults = await Promise.all(toSave.map((name) => actions.save(name)));
  if (saveResults.includes(false)) return;
  if (toRemove.length) {
    const removeResults = await Promise.all(toRemove.map((name) => actions.disable(name)));
    if (removeResults.includes(false)) return;
  }
  if (opts.successMessage) Message.success(opts.successMessage);
}

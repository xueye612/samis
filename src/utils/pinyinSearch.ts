import { pinyin } from 'pinyin-pro';

export function getPinyinInitials(text: string): string {
  return pinyin(text, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase();
}

export function getPinyinFull(text: string): string {
  return pinyin(text, { toneType: 'none', type: 'array' }).join('').toLowerCase();
}

/** Match label by substring or pinyin initials / full pinyin (简拼/全拼). */
export function matchesPinyinSearch(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const source = text.toLowerCase();
  if (source.includes(q)) return true;
  const initials = getPinyinInitials(text);
  if (initials.includes(q)) return true;
  const full = getPinyinFull(text);
  return full.includes(q);
}

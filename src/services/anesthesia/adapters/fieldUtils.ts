export function pickField(raw: unknown, keys: string[]): unknown {
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key];
    }
  }
  return undefined;
}

export function pickString(raw: unknown, keys: string[], fallback = ''): string {
  const value = pickField(raw, keys);
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

export function pickNumber(raw: unknown, keys: string[], fallback = 0): number {
  const value = pickField(raw, keys);
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function unwrapListPayload<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== 'object') return [];
  const record = data as Record<string, unknown>;
  const list = record.list ?? record.rows ?? record.data ?? record.records;
  if (Array.isArray(list)) return list as T[];
  return [];
}

export type FormFieldValue = string | number | boolean | null | undefined;

export type FormRecord = Record<string, FormFieldValue>;

/** Flat record → application/x-www-form-urlencoded body */
export function toFormUrlEncoded(record: FormRecord): string {
  const params = new URLSearchParams();
  Object.entries(record).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.set(key, String(value));
  });
  return params.toString();
}

export function stringifyFormJsonField(value: unknown): string {
  return JSON.stringify(value);
}

export function formPostInit(body: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  };
}

export function buildFormPost(record: FormRecord): RequestInit {
  return formPostInit(toFormUrlEncoded(record));
}

/** Map API payload object to flat form fields (skips nested objects). */
export function flatFormFieldsFromRecord(data: Record<string, unknown>): FormRecord {
  const out: FormRecord = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'object') return;
    out[key] = typeof value === 'number' || typeof value === 'boolean' ? value : String(value);
  });
  return out;
}

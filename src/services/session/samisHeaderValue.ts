/** fetch Header values must be ISO-8859-1 (Latin-1). */
export function isLatin1HeaderValue(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 0xff) return false;
  }
  return true;
}

/**
 * Make a value safe for `Headers.set`.
 * Prefer ASCII room codes from callers; Unicode is percent-encoded as fallback.
 */
export function toSamisHeaderValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (isLatin1HeaderValue(trimmed)) return trimmed;
  return encodeURIComponent(trimmed);
}

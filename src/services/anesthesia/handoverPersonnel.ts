const PERSON_SEPARATOR = /[\s、,，;；/|]+/u;

export function splitHandoverPersonnel(values: Array<string | null | undefined>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    String(value ?? '')
      .split(PERSON_SEPARATOR)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        if (seen.has(item)) return;
        seen.add(item);
        result.push(item);
      });
  });
  return result;
}

export function normalizeSingleHandoverPerson(value: string | null | undefined): string {
  return splitHandoverPersonnel([value])[0] ?? '';
}

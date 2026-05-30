export const SURGICAL_POSITION_OPTIONS = [
  '仰卧位',
  '左侧卧位',
  '右侧卧位',
  '俯卧位',
  '截石位',
  '沙滩椅位',
  '坐位',
  '甲状腺体位',
  '其他',
] as const;

export type SurgicalPositionOption = typeof SURGICAL_POSITION_OPTIONS[number];

export const SURGERY_NAME_JOINER = '+';

export function stripSurgeryOrdinal(name: string): string {
  return name.replace(/^\d+[.、)\s]*/, '').trim();
}

export function parseSurgeryNameValue(value?: string): string[] {
  if (!value?.trim()) return [];
  return value
    .split(SURGERY_NAME_JOINER)
    .map((item) => stripSurgeryOrdinal(item.trim()))
    .filter(Boolean);
}

export function formatNumberedSurgeryNames(names: string[]): string {
  return names.map((name, index) => `${index + 1}.${name}`).join(SURGERY_NAME_JOINER);
}

/** Plain display/storage: 术式A+术式B (no ordinals). */
export function formatSurgeryNamePlain(names: string[]): string {
  return names.join(SURGERY_NAME_JOINER);
}

export function formatSurgeryNameDisplay(value?: string): string {
  const names = parseSurgeryNameValue(value);
  return names.length ? formatSurgeryNamePlain(names) : '';
}

export function buildSurgeryNameOptions(cases: Array<{ surgeryName: string; actualSurgeryName?: string }>, current?: string) {
  const names = new Set<string>();
  const addNames = (value?: string) => {
    parseSurgeryNameValue(value).forEach((item) => names.add(item));
  };
  cases.forEach((item) => {
    if (item.surgeryName) names.add(item.surgeryName);
    addNames(item.actualSurgeryName);
  });
  addNames(current);
  return [...names].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

export function buildStaffOptions(
  doctors: string[],
  nurses: string[],
  role: 'anesthesiologist' | 'surgeon' | 'nurse',
) {
  if (role === 'nurse') return [...new Set(nurses)].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  return [...new Set(doctors)].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

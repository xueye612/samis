// 患者表头折叠摘要的纯展示逻辑：风险标识、术式变更判定。
// 抽离为纯函数以便在 node 环境下单测，不依赖 DOM。

export interface HeaderRiskInput {
  allergy?: string;
  difficultAirway?: string;
  preoperativeConditions?: string[];
}

export type HeaderRiskTone = 'danger' | 'warning';

export interface HeaderRiskFlag {
  key: string;
  label: string;
  tone: HeaderRiskTone;
}

const NEGATIVE_ALLERGY = new Set(['', '无', '无过敏', '不详', '未知', '未见异常']);
const POSITIVE_AIRWAY = ['困难', '预计困难', '是', 'yes', 'true', 'iii', 'iv', '3级', '4级'];
const INFECTION_PATTERN = /感染|传染|梅毒|艾滋|hiv|乙肝|丙肝|hbv|hcv|结核|携带/;

export function resolveHeaderRiskFlags(input: HeaderRiskInput): HeaderRiskFlag[] {
  const flags: HeaderRiskFlag[] = [];

  const allergy = (input.allergy ?? '').trim();
  if (allergy && !NEGATIVE_ALLERGY.has(allergy.toLowerCase())) {
    const display = allergy.length > 8 ? `${allergy.slice(0, 8)}…` : allergy;
    flags.push({ key: 'allergy', label: `过敏 ${display}`, tone: 'danger' });
  }

  const airway = (input.difficultAirway ?? '').trim().toLowerCase();
  if (airway && POSITIVE_AIRWAY.some((token) => airway.includes(token))) {
    flags.push({ key: 'airway', label: '困难气道', tone: 'danger' });
  }

  const conditions = input.preoperativeConditions ?? [];
  const infection = conditions.find((condition) => INFECTION_PATTERN.test(condition));
  if (infection) {
    flags.push({ key: 'infection', label: '感染风险', tone: 'warning' });
  }

  return flags;
}

// 拟施与实施手术不同 → 标记“术式已变更”，摘要只展示实施手术。
export function resolveSurgeryChanged(planned?: string, actual?: string): boolean {
  const plannedText = (planned ?? '').trim();
  const actualText = (actual ?? '').trim();
  if (!plannedText || !actualText) return false;
  return plannedText !== actualText;
}

// 摘要展示的实施手术：优先实施，回退拟施。
export function resolveDisplaySurgery(actual?: string, planned?: string, snapshotActual?: string): string {
  return (actual ?? snapshotActual ?? planned ?? '').trim() || '未记录';
}

/**
 * 交班临床快照统一映射层（唯一字段模型来源）。
 *
 * 后端 buildClinicalSnapshot 返回各业务表的 snake_case 原始行；
 * 页面/组件只能读取本 mapper 产出的统一 camelCase DTO，不得一处读 snake_case、一处读 camelCase，
 * 也不得在组件中用多个 a||b||c 临时兼容掩盖字段模型问题。
 */
export interface SnapshotItem { label: string; abnormal: boolean }
export interface SnapshotGroup { key: string; title: string; items: SnapshotItem[]; abnormal: boolean }
export interface MappedClinicalSnapshot {
  snapshotAt?: string;
  /** 阈值来源状态：default=使用默认安全阈值（未提供字典范围），dict=使用生命体征字典范围 */
  configNote: 'default' | 'dict';
  groups: SnapshotGroup[];
}

const toCamel = (s: string): string => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const normalize = (row: unknown): Record<string, unknown> => {
  if (!row || typeof row !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) out[toCamel(k)] = v;
  return out;
};
const normalizeArray = (arr: unknown): Record<string, unknown>[] => (Array.isArray(arr) ? arr.map((r) => normalize(r)) : []);

/** 生命体征异常阈值：单一显式来源（默认临床安全阈值）。
 *  优先使用生命体征字典的 lowerLimit/upperLimit；缺失时回退至此默认，并在页面标注“使用默认阈值”。 */
export const VITAL_ABNORMAL_DEFAULTS: Readonly<Record<string, { min?: number; max?: number }>> = Object.freeze({
  HR: { min: 50, max: 120 }, PULSE: { min: 50, max: 120 },
  SBP: { min: 90, max: 180 }, DBP: { max: 110 }, MAP: { min: 60, max: 110 },
  SPO2: { min: 95 }, RR: { min: 8, max: 30 }, ETCO2: { min: 25, max: 50 }, TEMP: { min: 35, max: 38.5 },
});

export interface VitalRange { lowerLimit?: number; upperLimit?: number }

/** 异常判定：优先字典范围，缺失回退默认阈值；阈值来源在 mapper 集中定义，不散落在组件。 */
export function isVitalAbnormal(metric: string, value: unknown, ranges?: Record<string, VitalRange>): boolean {
  const num = Number(value);
  if (!Number.isFinite(num)) return false;
  const m = String(metric ?? '').toUpperCase();
  const r = ranges?.[m];
  if (r && (r.lowerLimit != null || r.upperLimit != null)) {
    if (r.lowerLimit != null && num < r.lowerLimit) return true;
    if (r.upperLimit != null && num > r.upperLimit) return true;
    return false;
  }
  const d = VITAL_ABNORMAL_DEFAULTS[m];
  if (!d) return false;
  if (d.min != null && num < d.min) return true;
  if (d.max != null && num > d.max) return true;
  return false;
}

const group = (key: string, title: string, items: SnapshotItem[]): SnapshotGroup => ({
  key, title, items, abnormal: items.some((r) => r.abnormal),
});

/**
 * 将后端原始临床快照映射为统一展示 DTO。
 * @param raw 后端 clinicalSnapshot
 * @param vitalRanges 可选：生命体征字典范围（lowerLimit/upperLimit，按指标编码），用于替代默认阈值
 */
export function mapClinicalSnapshot(raw: unknown, vitalRanges?: Record<string, VitalRange>): MappedClinicalSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const snap = raw as Record<string, unknown>;
  const airway = normalizeArray(snap.airway);
  const ventilation = normalizeArray(snap.ventilation);
  const meds = normalizeArray(snap.activeMedications);
  const io = normalizeArray(snap.io);
  const vitals = normalizeArray(snap.latestVitals);
  const rescue = normalizeArray(snap.rescueEvents);

  const fmt = (v: unknown): string => (v === null || v === undefined || v === '') ? '' : String(v);

  const groups: SnapshotGroup[] = [];
  groups.push(group('airway', '气道', airway.map((r) => ({
    label: [fmt(r.action), r.deviceName ? fmt(r.deviceName) : '', r.occurredAt ? fmt(r.occurredAt) : ''].filter(Boolean).join(' '),
    abnormal: false,
  }))));
  groups.push(group('ventilation', '通气', ventilation.map((r) => ({
    label: [fmt(r.mode) || '通气段', r.fio2Percent ? `FiO₂ ${fmt(r.fio2Percent)}%` : ''].filter(Boolean).join(' '),
    abnormal: false,
  }))));
  groups.push(group('hemodynamics', '循环', vitals.map((r) => ({
    label: `${fmt(r.metric)} ${fmt(r.value)}${fmt(r.unit)}`.trim(),
    abnormal: isVitalAbnormal(String(r.metric ?? ''), r.value, vitalRanges),
  }))));
  groups.push(group('io', '出入量', io.map((r) => ({
    label: `${fmt(r.ioType)} ${fmt(r.volume)}${fmt(r.unit)}`.trim(),
    abnormal: false,
  }))));
  groups.push(group('meds', '持续用药', meds.map((r) => ({
    label: [fmt(r.displayText) || fmt(r.drugName), r.rate ? `${fmt(r.rate)}${fmt(r.rateUnit)}` : ''].filter(Boolean).join(' '),
    abnormal: false,
  }))));
  const abnormalVitals = vitals.filter((r) => isVitalAbnormal(String(r.metric ?? ''), r.value, vitalRanges));
  groups.push(group('abnVitals', '异常生命体征', abnormalVitals.map((r) => ({
    label: `${fmt(r.metric)} ${fmt(r.value)}${fmt(r.unit)}`.trim(),
    abnormal: true,
  }))));
  groups.push(group('rescue', '抢救事件', rescue.map((r) => ({
    label: [fmt(r.level) || '抢救', r.triggerDescription ? `：${fmt(r.triggerDescription)}` : ''].filter(Boolean).join(''),
    abnormal: true,
  }))));

  return {
    snapshotAt: typeof snap.snapshotAt === 'string' ? snap.snapshotAt : undefined,
    configNote: vitalRanges && Object.keys(vitalRanges).length ? 'dict' : 'default',
    groups: groups.filter((g) => g.items.length > 0),
  };
}

/**
 * 交班结构化项的字段级合并工具：以原始对象为基础，仅叠加编辑字段，
 * 保留原始对象中的未知扩展字段和未展示字段。
 * 新建项（_original 缺失）仅包含编辑字段。
 */
export function mergeStructuredItem<T extends Record<string, unknown>>(
  edited: T,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const base = edited._original ? { ...edited._original } : {};
  return { ...base, ...fields };
}

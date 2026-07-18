/**
 * 麻醉记录单事件符号配置（权威单一来源）。
 *
 * 麻醉记录单上的关键事件（入室、麻醉开始、插管、手术开始、拔管、出室等）以符号绘制在
 * 体征趋势图顶部的状态行，并在图例中复用。早期实现把符号字形硬编码在多个组件里，既无法
 * 配置、也依赖操作系统字体导致屏幕与打印模糊缺字。本模块统一收敛：
 *
 * - `keywords`：与事件名称做包含匹配（兼容“气管插管”“麻醉插管”等写法）。
 * - `symbol`：兜底字形（仅在无法渲染矢量时使用，不再作为唯一渲染来源）。
 * - `shape`：确定性矢量形状，由 `RecordClinicalSymbol` 用 SVG/CSS 统一绘制，
 *   保证 1366/1440/1920 屏幕与 A4 竖版打印一致、黑白可区分。
 * - `legend`：决定该事件是否进入图例及分组。
 *
 * 图例（RecordChartLegend）与时间轴状态符号（LiveAnesthesiaSheet）必须通过
 * `resolveEventSymbolDef` / `buildEventLegendPairs` / `buildRoomLegendItems`
 * 读取同一份定义，禁止在组件内复制第二套映射。
 *
 * 后续接入后端字典时，只需用接口返回的配置替换 `DEFAULT_RECORD_EVENT_SYMBOLS`，
 * 或向解析函数传入自定义注册表即可。
 */

export type ClinicalSymbolShape =
  | 'circle-filled'
  | 'circle-outline'
  | 'circle-ring'
  | 'circle-hbar'
  | 'circle-vbar'
  | 'circle-letter'
  | 'triangle-right-filled'
  | 'triangle-right-outline'
  | 'triangle-down'
  | 'triangle-up'
  | 'square'
  | 'diamond'
  | 'star'
  | 'text';

/**
 * 全部受支持的矢量形状登记表。新增形状必须在此登记，确保配置与渲染组件强一致。
 */
export const CLINICAL_SYMBOL_SHAPES: Readonly<Record<ClinicalSymbolShape, true>> = {
  'circle-filled': true,
  'circle-outline': true,
  'circle-ring': true,
  'circle-hbar': true,
  'circle-vbar': true,
  'circle-letter': true,
  'triangle-right-filled': true,
  'triangle-right-outline': true,
  'triangle-down': true,
  'triangle-up': true,
  square: true,
  diamond: true,
  star: true,
  text: true,
};

export type RecordEventLegendKind = 'pair' | 'room' | 'none';

export interface RecordEventSymbolDef {
  /** 稳定标识，便于后端字典对齐。 */
  key: string;
  /** 图例中展示的中文名称。 */
  label: string;
  /** 兜底字形（仅在不渲染矢量时使用，不再作为唯一渲染来源）。 */
  symbol: string;
  /** 确定性矢量形状，由 RecordClinicalSymbol 统一绘制。 */
  shape: ClinicalSymbolShape;
  /** 形状为 circle-letter / text 时叠加的字符。 */
  letter?: string;
  /** 与事件名称做包含匹配的关键字（按声明顺序优先匹配）。 */
  keywords: string[];
  /** 图例归类：成对事件 / 出入室 / 不进入图例。 */
  legend?: RecordEventLegendKind;
}

/**
 * 默认事件符号注册表（权威映射）。声明顺序即匹配优先级，更具体的关键字应靠前。
 */
export const DEFAULT_RECORD_EVENT_SYMBOLS: RecordEventSymbolDef[] = [
  { key: 'room-in', label: '入手术室', symbol: '▶', shape: 'triangle-right-filled', keywords: ['入手术室', '入室'], legend: 'room' },
  { key: 'anesthesia-start', label: '麻醉开始', symbol: '*', shape: 'star', keywords: ['麻醉开始'], legend: 'pair' },
  { key: 'anesthesia-end', label: '麻醉结束', symbol: '◎', shape: 'circle-ring', keywords: ['麻醉结束'], legend: 'pair' },
  { key: 'surgery-start', label: '手术开始', symbol: 'Ⓞ', shape: 'circle-letter', letter: 'O', keywords: ['手术开始'], legend: 'pair' },
  { key: 'surgery-end', label: '手术结束', symbol: 'Φ', shape: 'circle-vbar', keywords: ['手术结束'], legend: 'pair' },
  { key: 'intubation', label: '麻醉插管', symbol: 'Θ', shape: 'circle-hbar', keywords: ['插管'], legend: 'pair' },
  { key: 'extubation', label: '麻醉拔管', symbol: '▷', shape: 'triangle-right-outline', keywords: ['拔管'], legend: 'pair' },
  { key: 'laryngeal-mask', label: '喉罩', symbol: '罩', shape: 'text', letter: '罩', keywords: ['喉罩'], legend: 'none' },
  { key: 'puncture', label: '穿刺', symbol: '针', shape: 'text', letter: '针', keywords: ['穿刺'], legend: 'none' },
  { key: 'plane', label: '平面', symbol: 'T', shape: 'text', letter: 'T', keywords: ['平面'], legend: 'none' },
  { key: 'block', label: '阻滞', symbol: 'B', shape: 'text', letter: 'B', keywords: ['阻滞'], legend: 'none' },
  { key: 'room-out', label: '出手术室', symbol: '●', shape: 'circle-filled', keywords: ['出手术室', '离室'], legend: 'room' },
];

/** 未匹配到任何已知事件时的占位符号。 */
export const FALLBACK_EVENT_SYMBOL = '•';
/** 未匹配事件回退使用的矢量形状。 */
export const FALLBACK_EVENT_SHAPE: ClinicalSymbolShape = 'circle-outline';

/**
 * 根据事件名称解析完整定义。匹配失败时返回 undefined。
 */
export function resolveEventSymbolDef(
  eventType: string,
  registry: RecordEventSymbolDef[] = DEFAULT_RECORD_EVENT_SYMBOLS,
): RecordEventSymbolDef | undefined {
  if (!eventType) return undefined;
  return registry.find((item) => item.keywords.some((keyword) => eventType.includes(keyword)));
}

/**
 * 根据事件名称解析兜底字形。匹配失败时返回占位符号。
 * 注意：返回值仅用于无障碍/兜底，渲染应优先使用 `resolveEventSymbolDef().shape`。
 */
export function resolveEventSymbol(
  eventType: string,
  registry: RecordEventSymbolDef[] = DEFAULT_RECORD_EVENT_SYMBOLS,
): string {
  if (!eventType) return FALLBACK_EVENT_SYMBOL;
  return resolveEventSymbolDef(eventType, registry)?.symbol ?? FALLBACK_EVENT_SYMBOL;
}

export interface RecordEventLegendItem {
  /** 兜底字形。 */
  symbol: string;
  /** 矢量形状，图例与时间轴共用。 */
  shape: ClinicalSymbolShape;
  /** 形状叠加字符（circle-letter / text）。 */
  letter?: string;
  label: string;
}

/**
 * 构建“成对事件”图例（麻醉开始/结束、手术开始/结束、插管/拔管……），按每两项一行分组。
 */
export function buildEventLegendPairs(
  registry: RecordEventSymbolDef[] = DEFAULT_RECORD_EVENT_SYMBOLS,
): RecordEventLegendItem[][] {
  const pairItems = registry
    .filter((item) => item.legend === 'pair')
    .map((item) => ({ symbol: item.symbol, shape: item.shape, letter: item.letter, label: item.label }));
  const rows: RecordEventLegendItem[][] = [];
  for (let index = 0; index < pairItems.length; index += 2) {
    rows.push(pairItems.slice(index, index + 2));
  }
  return rows;
}

/**
 * 构建出入手术室图例。
 */
export function buildRoomLegendItems(
  registry: RecordEventSymbolDef[] = DEFAULT_RECORD_EVENT_SYMBOLS,
): RecordEventLegendItem[] {
  return registry
    .filter((item) => item.legend === 'room')
    .map((item) => ({ symbol: item.symbol, shape: item.shape, letter: item.letter, label: item.label }));
}

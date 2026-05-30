/**
 * 麻醉记录单事件符号配置。
 *
 * 麻醉记录单上的关键事件（入室、麻醉开始、插管、手术开始、拔管、出室等）以符号绘制在
 * 体征趋势图顶部的状态行。过去这些符号在组件内以一长串三元表达式硬编码，既无法配置、
 * 也无法在打印图例与绘制逻辑之间复用。此处将符号统一收敛为可配置的注册表：
 *
 * - `keywords`：用于与事件名称做包含匹配（兼容“气管插管”“麻醉插管”等写法）。
 * - `symbol`：绘制在时间轴上的字形。
 * - `legend`：决定该事件是否出现在图例中，以及以何种分组展示。
 *
 * 后续接入后端字典时，只需用接口返回的配置替换 `DEFAULT_RECORD_EVENT_SYMBOLS`，
 * 或向 `resolveEventSymbol` / `buildEventLegendPairs` 传入自定义注册表即可。
 */

export type RecordEventLegendKind = 'pair' | 'room' | 'none';

export interface RecordEventSymbolDef {
  /** 稳定标识，便于后端字典对齐。 */
  key: string;
  /** 图例中展示的中文名称。 */
  label: string;
  /** 绘制在时间轴上的符号字形。 */
  symbol: string;
  /** 与事件名称做包含匹配的关键字（按声明顺序优先匹配）。 */
  keywords: string[];
  /** 图例归类：成对事件 / 出入室 / 不进入图例。 */
  legend?: RecordEventLegendKind;
}

/**
 * 默认事件符号注册表。声明顺序即匹配优先级，更具体的关键字应靠前。
 */
export const DEFAULT_RECORD_EVENT_SYMBOLS: RecordEventSymbolDef[] = [
  { key: 'room-in', label: '入手术室', symbol: '▷', keywords: ['入手术室', '入室'], legend: 'room' },
  { key: 'anesthesia-start', label: '麻醉开始', symbol: 'X', keywords: ['麻醉开始'], legend: 'pair' },
  { key: 'anesthesia-end', label: '麻醉结束', symbol: '*', keywords: ['麻醉结束'], legend: 'pair' },
  { key: 'surgery-start', label: '手术开始', symbol: '◎', keywords: ['手术开始'], legend: 'pair' },
  { key: 'surgery-end', label: '手术结束', symbol: 'Ⓞ', keywords: ['手术结束'], legend: 'pair' },
  { key: 'intubation', label: '麻醉插管', symbol: 'Φ', keywords: ['插管'], legend: 'pair' },
  { key: 'extubation', label: '麻醉拔管', symbol: 'Θ', keywords: ['拔管'], legend: 'pair' },
  { key: 'laryngeal-mask', label: '喉罩', symbol: '罩', keywords: ['喉罩'], legend: 'none' },
  { key: 'puncture', label: '穿刺', symbol: '针', keywords: ['穿刺'], legend: 'none' },
  { key: 'plane', label: '平面', symbol: 'T', keywords: ['平面'], legend: 'none' },
  { key: 'block', label: '阻滞', symbol: 'B', keywords: ['阻滞'], legend: 'none' },
  { key: 'room-out', label: '出手术室', symbol: '▶', keywords: ['出手术室', '离室'], legend: 'room' },
];

/** 未匹配到任何已知事件时的占位符号。 */
export const FALLBACK_EVENT_SYMBOL = '•';

/**
 * 根据事件名称解析对应符号。匹配失败时返回占位符号。
 */
export function resolveEventSymbol(
  eventType: string,
  registry: RecordEventSymbolDef[] = DEFAULT_RECORD_EVENT_SYMBOLS,
): string {
  if (!eventType) return FALLBACK_EVENT_SYMBOL;
  const matched = registry.find((item) => item.keywords.some((keyword) => eventType.includes(keyword)));
  return matched?.symbol ?? FALLBACK_EVENT_SYMBOL;
}

export interface RecordEventLegendItem {
  symbol: string;
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
    .map((item) => ({ symbol: item.symbol, label: item.label }));
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
    .map((item) => ({ symbol: item.symbol, label: item.label }));
}

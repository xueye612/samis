import type { VitalSign } from '@/types/anesthesia';
import type { VitalSignDictItem } from '@/types/system';
import { resolveChartY, timeToPercent, vitalMarkerShape } from '@/services/anesthesiaRecordEngine';

/**
 * SVG 趋势层的纯绘制逻辑：把生命体征点位换算为 SVG 坐标、折线、标记路径与填充。
 * 与交互（拖拽、右键、状态符号高亮）解耦，便于单测与后续替换数据来源（设备采集/后端）。
 */
const SYMBOL_TEXT: Record<string, string> = {
  'triangle-down': '▽',
  'triangle-up': '△',
  circle: '●',
  'hollow-circle': '○',
  diamond: '◇',
  star: '★',
  square: '■',
  text: '•',
};

export function vitalSymbolText(symbol?: string) {
  return SYMBOL_TEXT[symbol ?? 'text'];
}

export function useVitalChartDrawing(
  getVitals: () => VitalSign[],
  getStart: () => string,
  getEnd: () => string,
) {
  const chartY = (value: number, item?: VitalSignDictItem) => resolveChartY(value, item?.shortCode);

  const chartPoints = (item: VitalSignDictItem) => getVitals()
    .map((row) => ({ row, value: row[item.shortCode as keyof VitalSign] }))
    .filter((entry): entry is { row: VitalSign; value: number } => typeof entry.value === 'number')
    .map((entry) => ({
      key: `${entry.row.id ?? entry.row.time}-${item.shortCode}`,
      row: entry.row,
      x: Math.min(1000, Math.max(0, timeToPercent(entry.row.time, getStart(), getEnd()) * 10)),
      y: chartY(entry.value, item),
    }));

  const chartLine = (item: VitalSignDictItem) => chartPoints(item).map((point) => `${point.x},${point.y}`).join(' ');

  const markerPath = (item: VitalSignDictItem, x: number, y: number) => {
    const marker = vitalMarkerShape(item);
    if (marker.shape === 'triangle-down') return `M ${x - 5} ${y - 4} L ${x + 5} ${y - 4} L ${x} ${y + 6} Z`;
    if (marker.shape === 'triangle-up') return `M ${x - 5} ${y + 5} L ${x + 5} ${y + 5} L ${x} ${y - 5} Z`;
    if (marker.shape === 'square') return `M ${x - 5} ${y - 5} H ${x + 5} V ${y + 5} H ${x - 5} Z`;
    if (marker.shape === 'diamond') return `M ${x} ${y - 6} L ${x + 6} ${y} L ${x} ${y + 6} L ${x - 6} ${y} Z`;
    if (marker.shape === 'hollow-circle' || marker.shape === 'circle') {
      return `M ${x} ${y - 5} A 5 5 0 1 1 ${x - 0.01} ${y - 5} Z`;
    }
    return `M ${x - 5} ${y} H ${x + 5} M ${x} ${y - 5} V ${y + 5}`;
  };

  const markerFill = (item: VitalSignDictItem) => (vitalMarkerShape(item).fill ? (item.chartColor ?? '#2563eb') : '#fff');

  return { chartY, chartPoints, chartLine, symbolText: vitalSymbolText, markerPath, markerFill };
}

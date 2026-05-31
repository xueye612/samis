import { defineComponent, h } from 'vue';
import type { RecordBandGrid } from '@/services/anesthesiaRecordEngine';

/**
 * 网格线（坐标层的可视化部分）：根据 RecordBandGrid 渲染竖向时间网格线与横向分隔线。
 * 业务带与 SVG 趋势层共用，避免在 3000+ 行的主组件里重复内联同一段渲染逻辑。
 */
export default defineComponent({
  name: 'RecordGridLines',
  props: {
    grid: { type: Object as () => RecordBandGrid, required: true },
    chart: { type: Boolean, default: false },
  },
  setup(props) {
    return () => [
      h('div', { class: 'print-grid-lines', 'aria-hidden': 'true' }, props.grid.verticalLines.map((line) =>
        h('span', { key: line.id, class: { major: line.isMajor }, style: { left: `${line.percent}%` } }),
      )),
      h('div', { class: props.chart ? 'print-chart-horizontal-lines' : 'print-row-lines', 'aria-hidden': 'true' }, props.grid.rowLines.map((line) =>
        h('span', { key: line.id, class: { major: line.isMajor }, style: { top: `${line.percent}%` } }),
      )),
    ];
  },
});

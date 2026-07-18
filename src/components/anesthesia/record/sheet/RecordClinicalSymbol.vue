<script setup lang="ts">
import { computed } from 'vue';
import {
  CLINICAL_SYMBOL_SHAPES,
  resolveEventSymbolDef,
  FALLBACK_EVENT_SHAPE,
  type ClinicalSymbolShape,
} from '@/config/recordEventSymbols';

/**
 * 临床事件/体征符号的统一矢量渲染组件。
 *
 * 用 SVG 绘制圆、空心圆、双环、带横/竖线圆、三角、方形、菱形、星形等，避免依赖操作系统
 * 字体导致屏幕模糊或缺字、打印变形。图例（RecordChartLegend）与时间轴状态符号
 * （LiveAnesthesiaSheet）共用本组件，符号形状来自 recordEventSymbols 单一配置源。
 *
 * 体征趋势图中的 marker 形状名（triangle-down/triangle-up/square/circle/...）同样由本组件
 * 渲染，保证图例与曲线点位一致、黑白可区分。
 */
const props = withDefaults(
  defineProps<{
    /** 矢量形状。与 event-type 二选一。 */
    shape?: ClinicalSymbolShape;
    /** 事件名称，自动从注册表解析形状与叠加字符。 */
    eventType?: string;
    /** 叠加字符（circle-letter / text 形状）。 */
    letter?: string;
    /** 颜色，默认墨色。体征曲线可传 chartColor。 */
    color?: string;
    /** 像素尺寸（宽=高）。 */
    size?: number;
    /** 描边宽度，默认 1.6（≥1.4，保证屏幕与打印清晰）。 */
    strokeWidth?: number;
    /** 无障碍标签。 */
    ariaLabel?: string;
  }>(),
  {
    color: '#111827',
    size: 14,
    strokeWidth: 1.6,
  },
);

const resolved = computed<{ shape: ClinicalSymbolShape; letter?: string }>(() => {
  if (props.shape) {
    const declared = CLINICAL_SYMBOL_SHAPES[props.shape] ? props.shape : FALLBACK_EVENT_SHAPE;
    return { shape: declared, letter: props.letter };
  }
  if (props.eventType) {
    const def = resolveEventSymbolDef(props.eventType);
    if (def) return { shape: def.shape, letter: props.letter ?? def.letter };
  }
  return { shape: FALLBACK_EVENT_SHAPE, letter: props.letter };
});

const shape = computed(() => resolved.value.shape);
const letter = computed(() => resolved.value.letter);
const half = computed(() => props.size / 2);
const innerSize = computed(() => props.size);
</script>

<template>
  <svg
    class="record-clinical-symbol"
    :width="innerSize"
    :height="innerSize"
    viewBox="0 0 24 24"
    :style="{ color: props.color }"
    :aria-label="ariaLabel"
    role="img"
    :aria-hidden="!ariaLabel"
  >
    <g
      :stroke="props.color"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <!-- 实心圆：出手术室 ● -->
      <circle v-if="shape === 'circle-filled'" cx="12" cy="12" r="8" :fill="props.color" stroke="none" />
      <!-- 空心圆：回退 -->
      <circle v-else-if="shape === 'circle-outline'" cx="12" cy="12" r="8" fill="none" />
      <!-- 双环：麻醉结束 ◎ -->
      <template v-else-if="shape === 'circle-ring'">
        <circle cx="12" cy="12" r="8.2" fill="none" />
        <circle cx="12" cy="12" r="2.8" :fill="props.color" stroke="none" />
      </template>
      <!-- 圆+横线：麻醉插管 Θ -->
      <template v-else-if="shape === 'circle-hbar'">
        <circle cx="12" cy="12" r="8" fill="none" />
        <line x1="4" y1="12" x2="20" y2="12" />
      </template>
      <!-- 圆+竖线：手术结束 Φ -->
      <template v-else-if="shape === 'circle-vbar'">
        <circle cx="12" cy="12" r="8" fill="none" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </template>
      <!-- 圆+字母：手术开始 Ⓞ -->
      <template v-else-if="shape === 'circle-letter'">
        <circle cx="12" cy="12" r="8.6" fill="none" />
      </template>
      <!-- 实心右三角：入手术室 ▶ -->
      <polygon
        v-else-if="shape === 'triangle-right-filled'"
        points="5,3.5 20.5,12 5,20.5"
        :fill="props.color"
        stroke="none"
      />
      <!-- 空心右三角：麻醉拔管 ▷ -->
      <polygon
        v-else-if="shape === 'triangle-right-outline'"
        points="5,3.5 20.5,12 5,20.5"
        fill="none"
      />
      <!-- 空心下三角：体征 ▽ -->
      <polygon
        v-else-if="shape === 'triangle-down'"
        points="3.5,6.5 20.5,6.5 12,20"
        fill="none"
      />
      <!-- 空心上三角：体征 △ -->
      <polygon
        v-else-if="shape === 'triangle-up'"
        points="3.5,17.5 20.5,17.5 12,4"
        fill="none"
      />
      <!-- 实心方：体征 ■ -->
      <rect v-else-if="shape === 'square'" x="4.5" y="4.5" width="15" height="15" :fill="props.color" stroke="none" />
      <!-- 空心菱形：体征 ◇ -->
      <polygon v-else-if="shape === 'diamond'" points="12,3 21,12 12,21 3,12" fill="none" />
      <!-- 五角星：麻醉开始 * -->
      <polygon
        v-else-if="shape === 'star'"
        points="12,2.6 14.7,9 21.5,9.5 16.3,14 18,20.8 12,17 6,20.8 7.7,14 2.5,9.5 9.3,9"
        :fill="props.color"
        stroke="none"
      />
    </g>
    <!-- 圆内字母 / 文字型符号 -->
    <text
      v-if="(shape === 'circle-letter' || shape === 'text') && letter"
      x="12"
      y="12"
      :font-size="shape === 'text' ? 13 : 9.5"
      font-weight="700"
      text-anchor="middle"
      dominant-baseline="central"
      :fill="props.color"
      class="record-clinical-symbol-text"
    >{{ letter }}</text>
  </svg>
</template>

<style scoped>
.record-clinical-symbol {
  display: inline-block;
  flex: none;
  vertical-align: middle;
  overflow: visible;
}

.record-clinical-symbol-text {
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', 'Source Han Sans SC',
    'Noto Sans CJK SC', system-ui, sans-serif;
  user-select: none;
}

@media print {
  .record-clinical-symbol {
    /* 矢量在 PDF 中保持锐利，颜色由 fill/stroke 控制，黑白可区分。 */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>

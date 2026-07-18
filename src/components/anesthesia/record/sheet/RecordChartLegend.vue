<script setup lang="ts">
import type { ClinicalSymbolShape } from '@/config/recordEventSymbols';
import type { RecordEventLegendItem } from '@/config/recordEventSymbols';
import RecordClinicalSymbol from '@/components/anesthesia/record/sheet/RecordClinicalSymbol.vue';

defineProps<{
  eventLegendPairs: RecordEventLegendItem[][];
  roomLegendItems: RecordEventLegendItem[];
  referenceLegendItems: Array<{ shortCode: string; chartColor?: string; chartSymbol?: string; legendLabel: string }>;
}>();

/**
 * 把体征曲线的 marker 形状名归一化为矢量形状。
 * 体征绘制层（useVitalChartDrawing）沿用 circle/hollow-circle 等历史名，此处统一映射，
 * 避免在多组件复制第二套符号定义。
 */
const vitalShape = (raw?: string): ClinicalSymbolShape => {
  if (raw === 'circle') return 'circle-filled';
  if (raw === 'hollow-circle') return 'circle-outline';
  if (raw === 'text') return 'circle-outline';
  return (raw as ClinicalSymbolShape) ?? 'circle-outline';
};
</script>

<template>
  <div class="chart-legend-panel">
    <div class="event-legend-pairs">
      <div v-for="(pair, index) in eventLegendPairs" :key="`pair-${index}`" class="legend-pair-row">
        <span v-for="item in pair" :key="item.label" class="legend-item">
          <RecordClinicalSymbol class="legend-symbol" :shape="item.shape" :letter="item.letter" :size="12" :aria-label="`${item.label} ${item.symbol}`" />
          <span class="legend-text">{{ item.label }}</span>
        </span>
      </div>
    </div>
    <div class="room-entry-legend">
      <span v-for="item in roomLegendItems" :key="item.label" class="legend-item">
        <RecordClinicalSymbol class="legend-symbol" :shape="item.shape" :letter="item.letter" :size="12" :aria-label="`${item.label} ${item.symbol}`" />
        <span class="legend-text">{{ item.label }}</span>
      </span>
    </div>
    <div class="vital-symbol-legend">
      <span v-for="item in referenceLegendItems" :key="item.shortCode" class="legend-item">
        <RecordClinicalSymbol class="legend-symbol" :shape="vitalShape(item.chartSymbol)" :color="item.chartColor" :size="12" :aria-label="item.legendLabel" />
        <span class="legend-text">{{ item.legendLabel }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.chart-legend-panel {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 4px;
  min-height: 300px;
  padding: 7px 5px;
  border-right: 1px solid #111827;
  background: #f8fafc;
  font-size: 10px;
}

.event-legend-pairs {
  display: grid;
  gap: 4px;
}

.legend-pair-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 16px;
  line-height: 1.2;
  white-space: normal;
}

.legend-symbol {
  flex: none;
}

.legend-text {
  min-width: 0;
}

.room-entry-legend {
  display: grid;
  gap: 2px;
  padding: 3px 0;
  border-top: 1px solid #dbeafe;
  border-bottom: 1px solid #dbeafe;
}

.vital-symbol-legend {
  display: grid;
  gap: 2px;
  align-content: start;
  padding-top: 2px;
}

@media print {
  .chart-legend-panel {
    background: #fff;
  }

  .legend-symbol {
    /* 矢量符号在 PDF 中保持锐利、黑白可区分。 */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>

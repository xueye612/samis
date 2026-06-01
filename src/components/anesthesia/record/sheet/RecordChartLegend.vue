<script setup lang="ts">
import { vitalSymbolText } from '@/components/anesthesia/record/sheet/useVitalChartDrawing';
import type { RecordEventLegendItem } from '@/config/recordEventSymbols';

defineProps<{
  eventLegendPairs: RecordEventLegendItem[][];
  roomLegendItems: RecordEventLegendItem[];
  referenceLegendItems: Array<{ shortCode: string; chartColor?: string; chartSymbol?: string; legendLabel: string }>;
}>();
</script>

<template>
  <div class="chart-legend-panel">
    <div class="event-legend-pairs">
      <div v-for="(pair, index) in eventLegendPairs" :key="`pair-${index}`" class="legend-pair-row">
        <span v-for="item in pair" :key="item.label"><b>{{ item.symbol }}</b>{{ item.label }}</span>
      </div>
    </div>
    <div class="room-entry-legend">
      <span v-for="item in roomLegendItems" :key="item.label"><b>{{ item.symbol }}</b>{{ item.label }}</span>
    </div>
    <div class="vital-symbol-legend">
      <span v-for="item in referenceLegendItems" :key="item.shortCode">
        <b :style="{ color: item.chartColor }">{{ vitalSymbolText(item.chartSymbol) }}</b>{{ item.legendLabel }}
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

.legend-pair-row span,
.room-entry-legend span,
.vital-symbol-legend span {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 16px;
  line-height: 1.2;
  white-space: normal;
}

.legend-pair-row b,
.room-entry-legend b,
.vital-symbol-legend b {
  min-width: 10px;
  color: #111827;
  font-weight: 700;
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
</style>

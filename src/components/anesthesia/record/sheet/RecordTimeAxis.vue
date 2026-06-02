<script setup lang="ts">
import type { LiveTimeScale, RecordBandGrid } from '@/services/anesthesiaRecordEngine';
defineProps<{
  timeScale: LiveTimeScale;
  grid: RecordBandGrid;
}>();
</script>

<template>
  <div class="sheet-ruler">
    <div class="ruler-label">
      <span class="ruler-kind">项目</span>
    </div>
    <div class="ruler-track">
      <span
        v-for="(tick, index) in timeScale.majorTicks"
        :key="tick.time"
        class="tick-label"
        :class="{ 'is-edge-start': index === 0, 'is-edge-end': index === timeScale.majorTicks.length - 1 }"
        :style="{ left: `${tick.percent}%` }"
      >{{ tick.label }}</span>
      <i v-for="line in grid.verticalLines" :key="`ruler-${line.id}`" :class="{ major: line.isMajor }" :style="{ left: `${line.percent}%` }"></i>
    </div>
  </div>
</template>

<style scoped>
.sheet-ruler {
  display: grid;
  grid-template-columns: var(--sheet-left-total, 140px) 1fr;
  align-items: stretch;
  margin: 6px 0 2px;
  font-size: 10px;
  border-bottom: 1px solid #111827;
}

.ruler-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-right: 1px solid #111827;
  background: #f8fafc;
  min-height: 32px;
  padding: 4px 6px;
}

.ruler-kind {
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
}

.ruler-track {
  position: relative;
  z-index: 2;
  height: 32px;
  border-bottom: 1px solid #cbd5e1;
  overflow: visible;
}

.ruler-track .tick-label {
  position: absolute;
  bottom: 2px;
  z-index: 2;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 0 3px;
  background: #fff;
  font-size: 12px;
  line-height: 1.2;
}

.ruler-track .tick-label.is-edge-start {
  transform: translateX(0);
}

.ruler-track .tick-label.is-edge-end {
  transform: translateX(-100%);
}

.ruler-track i {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  width: 1px;
  background: #e2e8f0;
}

.ruler-track i.major {
  background: #94a3b8;
}
</style>

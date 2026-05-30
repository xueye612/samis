<script setup lang="ts">
import { computed } from 'vue';
import type { LabResultRecord } from '@/types/anesthesiaRecord';
import { isoOrClockToClock } from '@/services/anesthesiaRecordEngine';

const props = defineProps<{
  labs: LabResultRecord[];
  leftFor: (time?: string) => string;
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  select: [lab: LabResultRecord];
}>();

const activeLabs = computed(() => props.labs.filter((item) => item.status === 'active'));
</script>

<template>
  <div v-if="activeLabs.length" class="lab-result-layer">
    <div class="lab-side">血气/检验</div>
    <div class="lab-track">
      <button
        v-for="lab in activeLabs"
        :key="lab.id"
        type="button"
        class="lab-marker"
        :class="{ abnormal: lab.items.some((item) => item.abnormal), brief: lab.displayMode !== 'full' }"
        :style="{ left: leftFor(lab.resultTime) }"
        :title="lab.items.map((item) => `${item.name} ${item.value}${item.unit}`).join('；')"
        :disabled="readOnly"
        @click="!readOnly && emit('select', lab)"
      >
        <template v-if="lab.displayMode === 'number'">#{{ lab.displayNumber ?? 1 }}</template>
        <template v-else-if="lab.displayMode === 'brief'">{{ lab.labType }}</template>
        <template v-else>
          <small>{{ isoOrClockToClock(lab.resultTime) }}</small>
          <span>{{ lab.items.slice(0, 3).map((item) => `${item.name}${item.value}`).join(' ') }}</span>
        </template>
      </button>
    </div>
    <div v-if="activeLabs.some((item) => item.displayMode === 'number')" class="lab-detail-list">
      <div v-for="lab in activeLabs.filter((item) => item.displayMode === 'number')" :key="`detail-${lab.id}`">
        <strong>#{{ lab.displayNumber }} {{ isoOrClockToClock(lab.resultTime) }}</strong>
        <span>{{ lab.items.map((item) => `${item.name} ${item.value}${item.unit}`).join('；') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab-result-layer {
  display: grid;
  grid-template-columns: var(--sheet-left-total, 140px) 1fr;
  gap: 0;
  margin: 0;
  font-size: 10px;
  border-bottom: 1px solid #111827;
}

.lab-side {
  display: grid;
  place-items: center;
  border-right: 1px solid #111827;
  background: #f8fafc;
  font-weight: 700;
  font-size: 12px;
}

.lab-track {
  position: relative;
  min-height: 28px;
  border-bottom: 1px dashed #cbd5e1;
}

.lab-marker {
  position: absolute;
  transform: translateX(-50%);
  max-width: 120px;
  border: 1px solid #64748b;
  background: #fff;
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 9px;
  line-height: 1.2;
  cursor: pointer;
  text-align: left;
}

.lab-marker:disabled {
  cursor: default;
  opacity: 0.92;
}

.lab-marker.abnormal {
  border-color: #dc2626;
  color: #dc2626;
}

.lab-marker.brief {
  max-width: 48px;
  text-align: center;
}

.lab-detail-list {
  grid-column: 2;
  display: grid;
  gap: 2px;
  margin-top: 2px;
  padding: 0 4px 4px;
}

.lab-detail-list strong {
  margin-right: 6px;
}
</style>

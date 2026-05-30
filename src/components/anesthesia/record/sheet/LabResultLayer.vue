<script setup lang="ts">
import { computed, ref } from 'vue';
import type { LabResultRecord } from '@/types/anesthesiaRecord';
import { isoOrClockToClock } from '@/services/anesthesiaRecordEngine';

const props = defineProps<{
  labs: LabResultRecord[];
  leftFor: (time?: string) => string;
  readOnly?: boolean;
  printMode?: boolean;
}>();

const emit = defineEmits<{
  select: [lab: LabResultRecord];
}>();

const detailLab = ref<LabResultRecord | null>(null);

const activeLabs = computed(() => props.labs.filter((item) => item.status === 'active'));

const positionedLabs = computed(() => {
  const buckets = new Map<string, LabResultRecord[]>();
  activeLabs.value.forEach((lab) => {
    const key = lab.resultTime ?? '';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)?.push(lab);
  });
  return [...buckets.entries()].flatMap(([time, rows]) =>
    rows.map((lab, lane) => ({ lab, time, lane })),
  );
});

const labSummary = (lab: LabResultRecord) => lab.items.map((item) => `${item.name} ${item.value}${item.unit}`).join('；');

const markerLabel = (lab: LabResultRecord) => {
  if (lab.displayMode === 'number') return `#${lab.displayNumber ?? 1}`;
  if (lab.displayMode === 'brief') return lab.labType || '检验';
  return '血气';
};

const openDetail = (lab: LabResultRecord) => {
  if (props.printMode) return;
  detailLab.value = lab;
};

const editDetail = () => {
  if (!detailLab.value) return;
  emit('select', detailLab.value);
};

const closeDetail = () => {
  detailLab.value = null;
};
</script>

<template>
  <div v-if="activeLabs.length" class="lab-result-layer" :class="{ 'is-print': printMode }">
    <div class="lab-side">血气/检验</div>
    <div class="lab-body">
      <div class="lab-track">
        <button
          v-for="entry in positionedLabs"
          :key="entry.lab.id"
          type="button"
          class="lab-marker"
          :class="{
            abnormal: entry.lab.items.some((item) => item.abnormal),
            'is-print': printMode,
          }"
          :style="{
            left: leftFor(entry.time),
            top: `${8 + entry.lane * 22}px`,
          }"
          :title="labSummary(entry.lab)"
          @click="openDetail(entry.lab)"
        >
          {{ markerLabel(entry.lab) }}
        </button>
      </div>

      <table v-if="printMode" class="lab-print-table">
        <thead>
          <tr>
            <th>序号</th>
            <th>时间</th>
            <th>类型</th>
            <th>结果</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lab in activeLabs" :key="`print-${lab.id}`">
            <td>{{ lab.displayMode === 'number' ? `#${lab.displayNumber ?? '-'}` : '-' }}</td>
            <td>{{ isoOrClockToClock(lab.resultTime) }}</td>
            <td>{{ lab.labType || '血气' }}</td>
            <td>{{ labSummary(lab) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="detailLab && !printMode" class="lab-detail-panel">
      <header>
        <strong>{{ detailLab.labType || '血气/检验' }}</strong>
        <span>{{ isoOrClockToClock(detailLab.resultTime) }}</span>
        <button type="button" class="lab-detail-close" @click="closeDetail">关闭</button>
      </header>
      <ul>
        <li v-for="item in detailLab.items" :key="item.name" :class="{ abnormal: item.abnormal }">
          <em>{{ item.name }}</em>
          <b>{{ item.value }}{{ item.unit }}</b>
        </li>
      </ul>
      <footer v-if="!readOnly">
        <button type="button" @click="editDetail">编辑</button>
      </footer>
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

.lab-body {
  min-width: 0;
}

.lab-track {
  position: relative;
  min-height: 36px;
  border-bottom: 1px dashed #cbd5e1;
}

.lab-marker {
  position: absolute;
  transform: translateX(-50%);
  min-width: 28px;
  height: 20px;
  padding: 0 6px;
  border: 1px solid #64748b;
  background: #fff;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 18px;
  cursor: pointer;
  text-align: center;
}

.lab-marker:disabled {
  cursor: default;
}

.lab-marker.abnormal {
  border-color: #dc2626;
  color: #dc2626;
  background: #fef2f2;
}

.lab-marker.is-print {
  border-color: #111827;
  background: #fff;
}

.lab-detail-panel {
  grid-column: 1 / -1;
  margin: 0;
  padding: 8px 10px;
  border-top: 1px solid #dbeafe;
  background: #f8fafc;
}

.lab-detail-panel header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.lab-detail-panel header strong {
  color: #0f172a;
  font-size: 12px;
}

.lab-detail-panel header span {
  color: #64748b;
  font-size: 11px;
}

.lab-detail-close {
  margin-left: auto;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 2px 8px;
  background: #fff;
  cursor: pointer;
  font-size: 11px;
}

.lab-detail-panel ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lab-detail-panel li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #fff;
  font-size: 11px;
}

.lab-detail-panel li.abnormal b {
  color: #dc2626;
}

.lab-detail-panel li em {
  color: #64748b;
  font-style: normal;
}

.lab-detail-panel footer {
  margin-top: 8px;
}

.lab-detail-panel footer button {
  border: 1px solid #2563eb;
  border-radius: 4px;
  padding: 4px 10px;
  background: #eff6ff;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 11px;
}

.lab-print-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
}

.lab-print-table th,
.lab-print-table td {
  border: 1px solid #94a3b8;
  padding: 3px 6px;
  text-align: left;
  vertical-align: top;
}

.lab-print-table th {
  background: #f8fafc;
  font-weight: 700;
}

.lab-result-layer.is-print .lab-track {
  min-height: 28px;
  border-bottom: none;
}
</style>

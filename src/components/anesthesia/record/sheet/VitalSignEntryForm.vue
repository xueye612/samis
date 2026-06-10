<script setup lang="ts">
import RecordTimeField from '@/components/anesthesia/record/sheet/RecordTimeField.vue';
import { formatVitalMonitorLabel } from '@/services/anesthesiaRecordEngine';
import type { VitalSignDictItem } from '@/types/system';

const props = defineProps<{
  form: { time: string; source: string; remark: string };
  values: Record<string, string>;
  rows: VitalSignDictItem[];
  batch?: boolean;
  endTime?: string;
  interval?: number;
}>();

const emit = defineEmits<{
  'update:form': [patch: Record<string, unknown>];
  'update:values': [patch: Record<string, string>];
  'update:endTime': [value: string];
  'update:interval': [value: number];
  shiftTime: [field: 'time' | 'endTime', delta: number];
}>();

const patchForm = (key: string, value: unknown) => emit('update:form', { [key]: value });
const patchValue = (code: string, value: string) => emit('update:values', { [code]: value });
const vitalLabel = (item: VitalSignDictItem) => formatVitalMonitorLabel(item);
</script>

<template>
  <div class="vital-entry-form">
    <section class="clinical-block">
      <div class="time-toolbar">
        <div class="time-item">
          <label class="field-label">记录时间</label>
          <RecordTimeField
            :model-value="form.time"
            @update:model-value="patchForm('time', $event)"
            @step="emit('shiftTime', 'time', $event)"
          />
        </div>
        <template v-if="batch">
          <div class="time-item">
            <label class="field-label">结束时间</label>
            <RecordTimeField
              :model-value="endTime ?? ''"
              @update:model-value="emit('update:endTime', $event)"
              @step="emit('shiftTime', 'endTime', $event)"
            />
          </div>
          <div class="time-item time-item--interval">
            <label class="field-label">间隔</label>
            <a-input-number
              :model-value="interval"
              :min="1"
              :max="60"
              hide-button
              @update:model-value="emit('update:interval', Number($event ?? 5))"
            >
              <template #suffix>分</template>
            </a-input-number>
          </div>
        </template>
      </div>

      <div class="vital-grid">
        <div v-for="item in rows" :key="item.shortCode" class="detail-cell">
          <label class="field-label vital-field-label">
            <span class="vital-label-zh">{{ vitalLabel(item).labelZh }}</span>
            <span class="vital-label-meta">{{ vitalLabel(item).labelCode }} · {{ vitalLabel(item).unit }}</span>
          </label>
          <a-input
            :model-value="values[item.shortCode] ?? ''"
            :placeholder="item.normalRange ? `参考 ${item.normalRange}` : ''"
            @update:model-value="patchValue(item.shortCode, $event)"
          />
        </div>
      </div>

      <div class="meta-row">
        <div class="detail-cell">
          <label class="field-label">来源</label>
          <a-input :model-value="form.source" @update:model-value="patchForm('source', $event)" />
        </div>
        <div class="detail-cell meta-remark">
          <label class="field-label">备注</label>
          <a-input :model-value="form.remark" placeholder="可选" @update:model-value="patchForm('remark', $event)" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.vital-entry-form {
  display: grid;
  gap: 0;
}

.clinical-block {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.field-label {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.time-toolbar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 10px;
}

.time-item {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.time-item--interval {
  max-width: 120px;
}

.vital-grid,
.meta-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 10px;
}

.detail-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.vital-field-label {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  line-height: 1.25;
}

.vital-label-zh {
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
}

.vital-label-meta {
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
}

.meta-remark {
  grid-column: 2 / -1;
}

.vital-entry-form :deep(.arco-input-wrapper),
.vital-entry-form :deep(.arco-input-number) {
  min-height: 32px;
}

@media (max-width: 520px) {
  .time-toolbar,
  .vital-grid,
  .meta-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .meta-remark {
    grid-column: 1 / -1;
  }

  .time-item--interval {
    max-width: none;
  }
}
</style>

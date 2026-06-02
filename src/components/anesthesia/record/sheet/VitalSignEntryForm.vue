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
  <a-form layout="vertical" class="vital-entry-form">
    <section class="form-panel">
      <div class="time-toolbar">
        <a-form-item label="记录时间" class="field-time">
          <RecordTimeField
            :model-value="form.time"
            @update:model-value="patchForm('time', $event)"
            @step="emit('shiftTime', 'time', $event)"
          />
        </a-form-item>
        <template v-if="batch">
          <a-form-item label="结束时间" class="field-time">
            <RecordTimeField
              :model-value="endTime"
              @update:model-value="emit('update:endTime', $event)"
              @step="emit('shiftTime', 'endTime', $event)"
            />
          </a-form-item>
          <a-form-item label="间隔" class="field-interval">
            <a-input-number
              :model-value="interval"
              :min="1"
              :max="60"
              hide-button
              @update:model-value="emit('update:interval', Number($event ?? 5))"
            >
              <template #suffix>分</template>
            </a-input-number>
          </a-form-item>
        </template>
      </div>

      <div class="vital-grid">
        <a-form-item
          v-for="item in rows"
          :key="item.shortCode"
          class="vital-field"
        >
          <template #label>
            <span class="vital-label-zh">{{ vitalLabel(item).labelZh }}</span>
            <span class="vital-label-meta">{{ vitalLabel(item).labelCode }} · {{ vitalLabel(item).unit }}</span>
          </template>
          <a-input
            :model-value="values[item.shortCode] ?? ''"
            :placeholder="item.normalRange ? `参考 ${item.normalRange}` : ''"
            @update:model-value="patchValue(item.shortCode, $event)"
          />
        </a-form-item>
      </div>

      <div class="meta-row">
        <a-form-item label="来源" class="field-source">
          <a-input :model-value="form.source" @update:model-value="patchForm('source', $event)" />
        </a-form-item>
        <a-form-item label="备注" class="field-remark">
          <a-input :model-value="form.remark" placeholder="可选" @update:model-value="patchForm('remark', $event)" />
        </a-form-item>
      </div>
    </section>
  </a-form>
</template>

<style scoped>
.vital-entry-form {
  display: grid;
  gap: 0;
}

.form-panel {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fafcff;
}

.time-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 10px;
  margin-bottom: 4px;
}

.field-time {
  flex: 0 1 168px;
  min-width: 128px;
  max-width: 168px;
}

.field-interval {
  flex: 0 1 100px;
  min-width: 88px;
  max-width: 120px;
}

.vital-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 10px;
}

.meta-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 0 10px;
  margin-top: 2px;
}

.vital-label-zh {
  display: block;
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}

.vital-label-meta {
  display: block;
  margin-top: 1px;
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
}

.vital-entry-form :deep(.arco-form-item) {
  margin-bottom: 6px;
}

.vital-entry-form :deep(.arco-form-item-label) {
  padding-bottom: 2px;
  line-height: 1.25;
}

.vital-entry-form :deep(.arco-input-wrapper) {
  min-height: 32px;
}

@media (max-width: 520px) {
  .vital-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .meta-row {
    grid-template-columns: 1fr;
  }
}
</style>

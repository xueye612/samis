<script setup lang="ts">
import RecordTimeField from '@/components/anesthesia/record/sheet/RecordTimeField.vue';
import RecordNumberField from '@/components/anesthesia/record/sheet/RecordNumberField.vue';
import type { OutputDetailRecord } from '@/types/anesthesia';

const OUTPUT_TYPES: OutputDetailRecord['type'][] = ['尿量', '出血量', '引流量', '其他'];

defineProps<{
  form: {
    time: string;
    type: OutputDetailRecord['type'];
    volume?: number;
    remark: string;
  };
  disabled?: boolean;
  editing?: boolean;
  batchValues?: Partial<Record<OutputDetailRecord['type'], number | undefined>>;
}>();

const emit = defineEmits<{
  'update:form': [patch: Record<string, unknown>];
  shiftTime: [delta: number];
  shiftVolume: [delta: number];
  'update:batchValue': [type: OutputDetailRecord['type'], value: number | undefined];
}>();

const selectType = (type: OutputDetailRecord['type']) => {
  emit('update:form', { type });
};
</script>

<template>
  <div class="output-line-form">
    <div class="form-panel">
      <div v-if="editing" class="form-grid">
        <label v-if="editing" class="field-block">
          <span class="field-label">记录时间</span>
          <RecordTimeField
            :model-value="form.time"
            :disabled="disabled"
            @update:model-value="emit('update:form', { time: $event })"
            @step="emit('shiftTime', $event)"
          />
        </label>
        <label class="field-block">
          <span class="field-label">容量 ml</span>
          <RecordNumberField
            :model-value="form.volume"
            :step="10"
            placeholder="必填"
            :disabled="disabled"
            @update:model-value="emit('update:form', { volume: $event })"
            @step="emit('shiftVolume', $event)"
          />
        </label>
      </div>

      <div v-if="!editing" class="batch-output-grid">
        <label v-for="item in OUTPUT_TYPES" :key="item" class="field-block">
          <span class="field-label">{{ item }}（ml）</span>
          <RecordNumberField
            :model-value="batchValues?.[item]"
            :step="10"
            placeholder="可选"
            :disabled="disabled"
            @update:model-value="emit('update:batchValue', item, $event)"
          />
        </label>
      </div>
      <p v-if="!editing" class="batch-hint">可连续填写多项，保存时一次写入；未填写的项目不会生成记录。</p>

      <div v-if="editing" class="field-block">
        <span class="field-label">出量类型</span>
        <div class="type-chip-row" role="group" aria-label="出量类型">
          <button
            v-for="item in OUTPUT_TYPES"
            :key="item"
            type="button"
            class="type-chip"
            :class="{ active: form.type === item }"
            :disabled="disabled"
            @click="selectType(item)"
          >
            {{ item }}
          </button>
        </div>
      </div>

      <label class="field-block">
        <span class="field-label">备注</span>
        <input
          class="remark-input"
          :value="form.remark"
          placeholder="可选"
          :disabled="disabled"
          @input="emit('update:form', { remark: ($event.target as HTMLInputElement).value })"
        />
      </label>
    </div>
  </div>
</template>

<style scoped>
.output-line-form {
  font-family: "Microsoft YaHei", sans-serif;
}

.form-panel {
  display: grid;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fafcff;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.field-block {
  display: grid;
  gap: 6px;
  margin: 0;
}

.field-label {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.type-chip-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.batch-output-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.batch-hint {
  margin: -2px 0 0;
  color: #64748b;
  font-size: 12px;
}

.type-chip {
  min-height: 34px;
  margin: 0;
  padding: 6px 4px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.type-chip:hover:not(:disabled) {
  border-color: #93c5fd;
  background: #f8fbff;
  color: #165dff;
}

.type-chip.active {
  border-color: #165dff;
  background: #eef5ff;
  color: #0f3a8c;
  box-shadow: 0 0 0 1px rgb(22 93 255 / 18%);
}

.type-chip:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.remark-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  font-size: 13px;
}

.remark-input:focus {
  border-color: #165dff;
  outline: none;
  box-shadow: 0 0 0 2px rgb(22 93 255 / 12%);
}

@media (max-width: 480px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .type-chip-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<script setup lang="ts">
import RecordTimeField from '@/components/anesthesia/record/sheet/RecordTimeField.vue';
import type { LabResultRecord } from '@/types/anesthesiaRecord';

const LAB_TYPES = ['动脉血气', '静脉血气', '其他'] as const;

const DISPLAY_MODES: Array<{ value: LabResultRecord['displayMode']; label: string }> = [
  { value: 'number', label: '编号' },
  { value: 'brief', label: '简略' },
  { value: 'full', label: '完整' },
];

const ABG_FIELDS = [
  { key: 'ph', label: 'pH', unit: '', placeholder: '7.35-7.45' },
  { key: 'pco2', label: 'pCO₂', unit: 'mmHg', placeholder: '35-45' },
  { key: 'po2', label: 'pO₂', unit: 'mmHg', placeholder: '80-100' },
  { key: 'be', label: 'BE', unit: 'mmol/L', placeholder: '-2~2' },
  { key: 'lac', label: '乳酸 Lac', unit: 'mmol/L', placeholder: '<2' },
] as const;

defineProps<{
  form: {
    resultTime: string;
    labType: string;
    displayMode: LabResultRecord['displayMode'];
    ph: string;
    pco2: string;
    po2: string;
    be: string;
    lac: string;
  };
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:form': [patch: Record<string, unknown>];
  shiftTime: [delta: number];
}>();

const patch = (key: string, value: unknown) => emit('update:form', { [key]: value });
</script>

<template>
  <div class="lab-entry-form">
    <section class="form-panel">
      <div class="form-row meta-row">
        <label class="field-block field-time">
          <span class="field-label">记录时间</span>
          <RecordTimeField
            :model-value="form.resultTime"
            :disabled="disabled"
            @update:model-value="patch('resultTime', $event)"
            @step="emit('shiftTime', $event)"
          />
        </label>
        <label class="field-block field-type">
          <span class="field-label">检验类型</span>
          <a-select
            :model-value="form.labType"
            allow-create
            allow-search
            popup-container="body"
            :disabled="disabled"
            placeholder="动脉血气"
            @update:model-value="patch('labType', $event)"
          >
            <a-option v-for="item in LAB_TYPES" :key="item" :value="item">{{ item }}</a-option>
          </a-select>
        </label>
      </div>

      <div class="field-block">
        <span class="field-label">趋势图显示</span>
        <a-radio-group
          :model-value="form.displayMode"
          type="button"
          class="display-mode-group"
          :disabled="disabled"
          @update:model-value="patch('displayMode', $event)"
        >
          <a-radio v-for="item in DISPLAY_MODES" :key="item.value" :value="item.value">{{ item.label }}</a-radio>
        </a-radio-group>
      </div>

      <div class="field-block">
        <span class="field-label">血气指标</span>
        <div class="abg-grid">
          <label
            v-for="field in ABG_FIELDS"
            :key="field.key"
            class="abg-field"
          >
            <span class="abg-label">
              <em>{{ field.label }}</em>
              <small v-if="field.unit">{{ field.unit }}</small>
            </span>
            <input
              class="abg-input"
              :value="form[field.key]"
              :placeholder="field.placeholder"
              :disabled="disabled"
              @input="patch(field.key, ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lab-entry-form {
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

.meta-row {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
  gap: 10px 12px;
  align-items: end;
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

.display-mode-group {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
}

.lab-entry-form :deep(.arco-radio-button) {
  width: 100%;
  text-align: center;
}

.lab-entry-form :deep(.arco-select-view-single) {
  min-height: 36px;
}

.abg-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 12px;
}

.abg-field {
  display: grid;
  gap: 4px;
  margin: 0;
}

.abg-label em {
  display: block;
  color: #0f172a;
  font-style: normal;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}

.abg-label small {
  display: block;
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
}

.abg-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 34px;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.abg-input:focus {
  border-color: #165dff;
  outline: none;
  box-shadow: 0 0 0 2px rgb(22 93 255 / 12%);
}

.abg-input:disabled {
  background: #f8fafc;
  color: #94a3b8;
}

@media (max-width: 520px) {
  .meta-row {
    grid-template-columns: 1fr;
  }

  .abg-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

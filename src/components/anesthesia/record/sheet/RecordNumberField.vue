<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  modelValue?: number;
  min?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
}>(), {
  min: 0,
  step: 10,
  placeholder: '',
  disabled: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: number | undefined];
  step: [delta: number];
}>();

const displayValue = computed(() => (
  props.modelValue === undefined || Number.isNaN(props.modelValue) ? '' : String(props.modelValue)
));

const onInput = (raw: string) => {
  if (!raw.trim()) {
    emit('update:modelValue', undefined);
    return;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) return;
  emit('update:modelValue', Math.max(props.min, value));
};
</script>

<template>
  <div class="record-number-field" :class="{ disabled }">
    <button
      type="button"
      class="step-btn"
      :disabled="disabled"
      aria-label="减少"
      @click="emit('step', -1)"
    >−</button>
    <input
      :value="displayValue"
      type="number"
      :min="min"
      :step="step"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput(($event.target as HTMLInputElement).value)"
    />
    <button
      type="button"
      class="step-btn"
      :disabled="disabled"
      aria-label="增加"
      @click="emit('step', 1)"
    >+</button>
  </div>
</template>

<style scoped>
.record-number-field {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  align-items: stretch;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.record-number-field:focus-within {
  border-color: #165dff;
  box-shadow: 0 0 0 2px rgb(22 93 255 / 12%);
}

.record-number-field.disabled {
  background: #f8fafc;
}

.step-btn {
  display: grid;
  place-items: center;
  margin: 0;
  padding: 0;
  border: 0;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #334155;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.record-number-field .step-btn:last-child {
  border-right: 0;
  border-left: 1px solid #e2e8f0;
}

.step-btn:hover:not(:disabled) {
  background: #eef5ff;
  color: #165dff;
}

.step-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.record-number-field input {
  width: 100%;
  min-width: 0;
  min-height: 36px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}

.record-number-field input:focus {
  outline: none;
}

.record-number-field input:disabled {
  color: #94a3b8;
}

.record-number-field input::placeholder {
  color: #94a3b8;
  font-weight: 500;
}
</style>

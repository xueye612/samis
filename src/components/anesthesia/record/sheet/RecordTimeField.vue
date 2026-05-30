<script setup lang="ts">
defineProps<{
  modelValue: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  step: [delta: number];
}>();
</script>

<template>
  <div class="record-time-field" :class="{ disabled }">
    <button type="button" class="step-btn" :disabled="disabled" aria-label="减 1 分钟" @click="emit('step', -1)">−</button>
    <input
      :value="modelValue"
      type="time"
      step="60"
      :disabled="disabled"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <button type="button" class="step-btn" :disabled="disabled" aria-label="加 1 分钟" @click="emit('step', 1)">+</button>
  </div>
</template>

<style scoped>
.record-time-field {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  align-items: stretch;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.record-time-field:focus-within {
  border-color: #165dff;
  box-shadow: 0 0 0 2px rgb(22 93 255 / 12%);
}

.record-time-field.disabled {
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

.record-time-field .step-btn:last-child {
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

.record-time-field input {
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

.record-time-field input:focus {
  outline: none;
}

.record-time-field input:disabled {
  color: #94a3b8;
}
</style>

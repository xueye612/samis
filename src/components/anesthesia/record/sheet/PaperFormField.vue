<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  label: string;
  modelValue?: string;
  readonly?: boolean;
  multiline?: boolean;
  placeholder?: string;
  span?: number;
  printMode?: boolean;
  compact?: boolean;
}>(), {
  modelValue: '',
  readonly: false,
  multiline: false,
  placeholder: '',
  span: 1,
  printMode: false,
  compact: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const displayValue = computed(() => props.modelValue || props.placeholder || '');

const onInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLInputElement | HTMLTextAreaElement).value);
};
</script>

<template>
  <div
    class="paper-field"
    :class="{
      'is-readonly': readonly,
      'is-print': printMode,
      'is-multiline': multiline,
      compact,
    }"
    :style="span > 1 ? { gridColumn: `span ${span}` } : undefined"
  >
    <label class="paper-field-label">{{ label }}</label>
    <textarea
      v-if="multiline && !readonly && !printMode"
      class="paper-field-input"
      :value="modelValue"
      :placeholder="placeholder"
      rows="1"
      @input="onInput"
    />
    <input
      v-else-if="!readonly && !printMode"
      class="paper-field-input"
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      @input="onInput"
    />
    <span
      v-else
      class="paper-field-value"
      :title="displayValue"
    >{{ displayValue }}</span>
  </div>
</template>

<style scoped>
.paper-field {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 8px;
  align-items: center;
  min-width: 0;
  letter-spacing: 0;
}

.paper-field.compact {
  gap: 3px 6px;
}

.paper-field-label {
  color: #111827;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1.3;
}

.paper-field-input,
.paper-field-value {
  width: 100%;
  min-height: 18px;
  margin: 0;
  padding: 0 2px 2px;
  border: 0;
  border-bottom: 1px solid #cbd5e1;
  border-radius: 0;
  background: transparent;
  color: #111827;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  font-family: inherit;
  letter-spacing: 0;
}

.paper-field-input:focus {
  outline: none;
  background: #fff;
  border-bottom-color: #111827;
}

.paper-field.compact.is-multiline .paper-field-input {
  min-height: 20px;
  resize: vertical;
}

.paper-field.is-readonly .paper-field-value {
  color: #111827;
  border-bottom-color: #e2e8f0;
  background: transparent;
}

.paper-field-value {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paper-field.compact.field-full .paper-field-value,
.paper-field.compact.is-multiline .paper-field-value {
  white-space: nowrap;
}

.paper-field.is-print .paper-field-value,
.paper-field.is-print .paper-field-input {
  border-bottom-color: #555;
}

@media print {
  .paper-field-value {
    white-space: normal;
    word-break: break-word;
  }
}
</style>

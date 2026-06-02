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
  interactionMode?: 'edit' | 'view' | 'print';
  compact?: boolean;
}>(), {
  modelValue: '',
  readonly: false,
  multiline: false,
  placeholder: '',
  span: 1,
  printMode: false,
  interactionMode: 'edit',
  compact: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const isEditable = computed(() => !props.readonly && !props.printMode && props.interactionMode === 'edit');
const isPrintLike = computed(() => props.printMode || props.interactionMode === 'print');
const isViewLike = computed(() => props.interactionMode === 'view' && !props.printMode);

const displayValue = computed(() => {
  if (props.modelValue?.trim()) return props.modelValue;
  if (isEditable.value && props.placeholder) return props.placeholder;
  return '';
});

const inputPlaceholder = computed(() => (
  isEditable.value ? (props.placeholder || '点击填写') : ''
));

const onInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLInputElement | HTMLTextAreaElement).value);
};
</script>

<template>
  <div
    class="paper-field"
    :class="{
      'is-readonly': readonly || isViewLike,
      'is-print': isPrintLike,
      'is-view': isViewLike,
      'is-editable': isEditable,
      'is-multiline': multiline,
      compact,
      'is-empty': !modelValue?.trim(),
    }"
    :style="span > 1 ? { gridColumn: `span ${span}` } : undefined"
  >
    <label class="paper-field-label">{{ label }}</label>
    <textarea
      v-if="multiline && isEditable"
      class="paper-field-input"
      :value="modelValue"
      :placeholder="inputPlaceholder"
      rows="1"
      @input="onInput"
    />
    <input
      v-else-if="isEditable"
      class="paper-field-input"
      type="text"
      :value="modelValue"
      :placeholder="inputPlaceholder"
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

.paper-field.is-editable.is-empty .paper-field-input::placeholder {
  color: #94a3b8;
}

.paper-field.is-editable:hover .paper-field-input {
  border-bottom-color: #94a3b8;
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

.paper-field.is-readonly .paper-field-value,
.paper-field.is-view .paper-field-value {
  color: #111827;
  border-bottom-color: #e2e8f0;
  background: transparent;
}

.paper-field.is-print .paper-field-value,
.paper-field.is-print .paper-field-input {
  border-bottom-color: #555;
}

.paper-field.is-print .paper-field-input::placeholder,
.paper-field.is-print .paper-field-value:empty {
  color: transparent;
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

@media print {
  .paper-field-value {
    white-space: normal;
    word-break: break-word;
  }
}
</style>

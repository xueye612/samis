<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import RecordModalShell from '@/components/anesthesia/record/RecordModalShell.vue';
import {
  formatSurgeryNameDisplay,
  formatSurgeryNamePlain,
  parseSurgeryNameValue,
  SURGERY_NAME_JOINER,
} from '@/config/recordHeaderOptions';
import { matchesPinyinSearch } from '@/utils/pinyinSearch';

const props = withDefaults(defineProps<{
  label: string;
  modelValue?: string;
  options?: string[];
  readonly?: boolean;
  printMode?: boolean;
  placeholder?: string;
  span?: number;
  compact?: boolean;
  allowCustom?: boolean;
  multiple?: boolean;
  joiner?: string;
  pinyinSearch?: boolean;
  numbered?: boolean;
}>(), {
  modelValue: '',
  options: () => [],
  readonly: false,
  printMode: false,
  placeholder: '点击选择',
  span: 1,
  compact: true,
  allowCustom: true,
  multiple: false,
  joiner: '、',
  pinyinSearch: false,
  numbered: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  pick: [value: string];
}>();

const visible = ref(false);
const keyword = ref('');
const customValue = ref('');
const selected = ref<string[]>([]);

const parseValue = (value?: string) => {
  if (!value?.trim()) return [];
  if (props.numbered) return parseSurgeryNameValue(value);
  return value.split(props.joiner).map((item) => item.trim()).filter(Boolean);
};

const serializeValue = (values: string[]) => {
  if (props.numbered) return formatSurgeryNamePlain(values);
  return values.join(props.joiner);
};

const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder;
  if (props.numbered) return formatSurgeryNameDisplay(props.modelValue) || props.placeholder;
  return props.modelValue;
});

const filteredOptions = computed(() => {
  const text = keyword.value.trim();
  const list = props.options;
  if (!text) return list;
  if (props.pinyinSearch) {
    return list.filter((item) => matchesPinyinSearch(item, text));
  }
  return list.filter((item) => item.includes(text));
});

const openPicker = () => {
  if (props.readonly || props.printMode) return;
  keyword.value = '';
  customValue.value = '';
  selected.value = parseValue(props.modelValue);
  visible.value = true;
};

const isSelected = (value: string) => selected.value.includes(value);

const selectionIndex = (value: string) => selected.value.indexOf(value) + 1;

const toggleOption = (value: string) => {
  if (props.multiple) {
    const index = selected.value.indexOf(value);
    if (index >= 0) selected.value.splice(index, 1);
    else selected.value.push(value);
    return;
  }
  emit('update:modelValue', value);
  emit('pick', value);
  visible.value = false;
};

const removeSelected = (index: number) => {
  selected.value.splice(index, 1);
};

const confirmSelection = () => {
  const value = serializeValue(selected.value);
  emit('update:modelValue', value);
  emit('pick', value);
  visible.value = false;
};

const confirmCustom = () => {
  const value = customValue.value.trim();
  if (!value) return;
  if (props.multiple) {
    if (!selected.value.includes(value)) selected.value.push(value);
    confirmSelection();
    return;
  }
  emit('update:modelValue', value);
  emit('pick', value);
  visible.value = false;
};

watch(visible, (open) => {
  if (open) selected.value = parseValue(props.modelValue);
});
</script>

<template>
  <div
    class="paper-picker-field"
    :class="{
      'is-readonly': readonly,
      'is-print': printMode,
      'is-editable': !readonly && !printMode,
      compact,
    }"
    :style="span > 1 ? { gridColumn: `span ${span}` } : undefined"
  >
    <label class="paper-picker-label">{{ label }}</label>
    <button
      v-if="!readonly && !printMode"
      type="button"
      class="paper-picker-trigger"
      @click="openPicker"
    >
      <span class="paper-picker-value" :class="{ empty: !modelValue }">{{ displayValue }}</span>
      <em class="paper-picker-action">▾ 选择</em>
    </button>
    <span v-else class="paper-picker-readonly">{{ displayValue }}</span>

    <RecordModalShell
      v-if="visible"
      :size="multiple ? 'medium' : 'small'"
      top-layer
      :title="multiple ? `选择${label}` : `选择${label}`"
      @close="visible = false"
    >
      <div class="picker-panel">
        <div class="picker-search-wrap">
          <span class="picker-search-icon" aria-hidden="true">⌕</span>
          <input
            v-model="keyword"
            class="picker-search"
            type="search"
            :placeholder="pinyinSearch ? '输入名称、简拼或全拼…' : '输入关键词搜索…'"
          />
        </div>

        <div v-if="multiple && selected.length" class="picker-selected-panel">
          <div class="picker-selected-head">
            <strong>已选 {{ selected.length }} 项</strong>
            <span v-if="numbered">按顺序自动编号 1、2、3…</span>
          </div>
          <div class="picker-selected-chips">
            <span v-for="(item, index) in selected" :key="`${item}-${index}`" class="picker-chip">
              <em v-if="numbered" class="picker-chip-order">{{ index + 1 }}</em>
              <span class="picker-chip-text">{{ item }}</span>
              <button type="button" class="picker-chip-remove" aria-label="移除" @click="removeSelected(index)">×</button>
            </span>
          </div>
        </div>

        <div class="picker-list-wrap">
          <div class="picker-list">
            <button
              v-for="item in filteredOptions"
              :key="item"
              type="button"
              class="picker-option"
              :class="{ active: multiple ? isSelected(item) : item === modelValue }"
              @click="toggleOption(item)"
            >
              <span v-if="multiple && numbered && isSelected(item)" class="picker-option-order">{{ selectionIndex(item) }}</span>
              <span v-else-if="multiple" class="picker-option-check" :class="{ on: isSelected(item) }" />
              <span class="picker-option-text">{{ item }}</span>
            </button>
            <p v-if="!filteredOptions.length" class="picker-empty">无匹配项，可尝试简拼或手工录入</p>
          </div>
        </div>

        <div v-if="allowCustom" class="picker-custom">
          <label>手工录入</label>
          <div class="picker-custom-row">
            <input v-model="customValue" type="text" placeholder="输入后点击添加" />
            <button type="button" class="picker-btn primary" @click="confirmCustom">添加</button>
          </div>
        </div>

        <div v-if="multiple" class="picker-footer">
          <button type="button" class="picker-btn ghost" @click="visible = false">取消</button>
          <button type="button" class="picker-btn primary" :disabled="!selected.length" @click="confirmSelection">
            确定{{ selected.length ? `（${selected.length}项）` : '' }}
          </button>
        </div>
      </div>
    </RecordModalShell>
  </div>
</template>

<style scoped>
.paper-picker-field {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 8px;
  align-items: center;
  min-width: 0;
}

.paper-picker-label {
  color: #334155;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.paper-picker-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 20px;
  margin: 0;
  padding: 1px 4px 2px;
  border: 1px dashed #93c5fd;
  border-radius: 3px;
  background: #f0f7ff;
  color: #111827;
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.paper-picker-field.compact .paper-picker-trigger {
  min-height: 17px;
  padding: 0 4px 1px;
}

.paper-picker-field.is-editable .paper-picker-trigger {
  box-shadow: inset 0 0 0 1px rgb(37 99 235 / 8%);
}

.paper-picker-trigger:hover {
  border-color: #2563eb;
  background: #e8f1ff;
}

.paper-picker-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paper-picker-value.empty {
  color: #64748b;
}

.paper-picker-action {
  flex-shrink: 0;
  font-style: normal;
  font-size: 10px;
  color: #2563eb;
  font-weight: 600;
}

.paper-picker-readonly {
  min-height: 18px;
  padding: 0 2px 2px;
  border-bottom: 1px solid #cbd5e1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-panel {
  display: grid;
  gap: 14px;
}

.picker-search-wrap {
  position: relative;
}

.picker-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  font-size: 16px;
  pointer-events: none;
}

.picker-search {
  width: 100%;
  padding: 10px 12px 10px 34px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  font-size: 14px;
  box-shadow: inset 0 1px 2px rgb(15 23 42 / 4%);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.picker-search:focus {
  outline: none;
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px rgb(59 130 246 / 12%);
}

.picker-selected-panel {
  padding: 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f0f7ff 0%, #f8fafc 100%);
  border: 1px solid #dbeafe;
}

.picker-selected-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.picker-selected-head strong {
  color: #1e3a8a;
  font-size: 13px;
}

.picker-selected-head span {
  color: #64748b;
  font-size: 12px;
}

.picker-selected-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.picker-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 8px 4px 4px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid #bfdbfe;
  box-shadow: 0 1px 2px rgb(37 99 235 / 8%);
}

.picker-chip-order {
  display: grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #2563eb;
  color: #fff;
  font-style: normal;
  font-size: 12px;
  font-weight: 700;
}

.picker-chip-text {
  font-size: 13px;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-chip-remove {
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.picker-chip-remove:hover {
  background: #fee2e2;
  color: #dc2626;
}

.picker-list-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.picker-list {
  display: grid;
  gap: 0;
  max-height: 260px;
  overflow: auto;
}

.picker-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 14px;
  border: 0;
  border-bottom: 1px solid #f1f5f9;
  background: #fff;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.12s;
}

.picker-option:last-child {
  border-bottom: 0;
}

.picker-option:hover {
  background: #f8fafc;
}

.picker-option.active {
  background: #eff6ff;
}

.picker-option-order {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #2563eb;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.picker-option-check {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border: 2px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
}

.picker-option-check.on {
  border-color: #2563eb;
  background: #2563eb;
  box-shadow: inset 0 0 0 2px #fff;
}

.picker-option-text {
  flex: 1;
  min-width: 0;
  color: #1e293b;
  line-height: 1.4;
}

.picker-empty {
  margin: 0;
  padding: 24px 16px;
  color: #64748b;
  font-size: 13px;
  text-align: center;
}

.picker-custom label {
  display: block;
  margin-bottom: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
}

.picker-custom-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.picker-custom-row input {
  padding: 9px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
}

.picker-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
  border-top: 1px solid #e2e8f0;
}

.picker-btn {
  min-width: 72px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.picker-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.picker-btn.ghost {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
}

.picker-btn.ghost:hover:not(:disabled) {
  background: #f8fafc;
}

.picker-btn.primary {
  border: 0;
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgb(37 99 235 / 28%);
}

.picker-btn.primary:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgb(37 99 235 / 35%);
}
</style>

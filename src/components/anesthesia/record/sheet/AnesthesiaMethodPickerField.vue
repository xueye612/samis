<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AnesthesiaTypeSelector from '@/components/anesthesia/record/AnesthesiaTypeSelector.vue';
import RecordModalShell from '@/components/anesthesia/record/RecordModalShell.vue';
import { formatAnesthesiaMethodLabel, mergeSelectedMethods } from '@/services/anesthesiaRecordMethodEngine';
import type { AnesthesiaMethodKey } from '@/mock/anesthesiaRecordPrototype';

const props = withDefaults(defineProps<{
  label?: string;
  primary: AnesthesiaMethodKey;
  auxiliary: AnesthesiaMethodKey[];
  readonly?: boolean;
  printMode?: boolean;
  interactionMode?: 'edit' | 'view' | 'print';
  span?: number;
  compact?: boolean;
}>(), {
  label: '麻醉方法',
  readonly: false,
  printMode: false,
  interactionMode: 'edit',
  span: 1,
  compact: true,
});

const emit = defineEmits<{
  apply: [payload: { primary: AnesthesiaMethodKey; auxiliary: AnesthesiaMethodKey[] }];
}>();

const visible = ref(false);
const draftPrimary = ref<AnesthesiaMethodKey>(props.primary);
const draftAuxiliary = ref<AnesthesiaMethodKey[]>([...props.auxiliary]);

const displayValue = computed(() => {
  const text = formatAnesthesiaMethodLabel(mergeSelectedMethods(props.primary, props.auxiliary));
  return text || '点击选择麻醉方式';
});

const openPicker = () => {
  if (props.readonly || props.printMode || props.interactionMode !== 'edit') return;
  draftPrimary.value = props.primary;
  draftAuxiliary.value = [...props.auxiliary];
  visible.value = true;
};

const confirm = () => {
  emit('apply', { primary: draftPrimary.value, auxiliary: [...draftAuxiliary.value] });
  visible.value = false;
};

watch(visible, (open) => {
  if (!open) return;
  draftPrimary.value = props.primary;
  draftAuxiliary.value = [...props.auxiliary];
});
</script>

<template>
  <div
    class="paper-picker-field"
    :class="{
      'is-readonly': readonly || interactionMode === 'view',
      'is-print': printMode || interactionMode === 'print',
      'is-view': interactionMode === 'view' && !printMode,
      'is-editable': !readonly && !printMode && interactionMode === 'edit',
      compact,
    }"
    :style="span > 1 ? { gridColumn: `span ${span}` } : undefined"
  >
    <label class="paper-picker-label">{{ label }}</label>
    <button
      v-if="!readonly && !printMode && interactionMode === 'edit'"
      type="button"
      class="paper-picker-trigger"
      @click="openPicker"
    >
      <span class="paper-picker-value" :class="{ empty: !displayValue || displayValue.startsWith('点击') }">{{ displayValue }}</span>
      <em class="paper-picker-action">▾ 选择</em>
    </button>
    <span v-else class="paper-picker-readonly">{{ displayValue }}</span>

    <RecordModalShell
      v-if="visible"
      size="medium"
      top-layer
      title="麻醉方式选择"
      @close="visible = false"
    >
      <div class="method-picker-body">
        <p class="method-picker-hint">与右侧「麻醉方式选择」一致：主方式单选，辅助方式可叠加。</p>
        <AnesthesiaTypeSelector
          compact
          :primary="draftPrimary"
          :auxiliary="draftAuxiliary"
          @update:primary="draftPrimary = $event"
          @update:auxiliary="draftAuxiliary = $event"
        />
        <div class="method-picker-footer">
          <button type="button" class="picker-btn ghost" @click="visible = false">取消</button>
          <button type="button" class="picker-btn primary" @click="confirm">确定</button>
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
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
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

.paper-picker-field.is-editable .paper-picker-trigger:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.paper-picker-field.is-editable .paper-picker-action {
  opacity: 0;
}

.paper-picker-field.is-editable .paper-picker-trigger:hover .paper-picker-action {
  opacity: 1;
}

.paper-picker-field.is-editable .paper-picker-trigger {
  box-shadow: none;
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

.method-picker-body {
  display: grid;
  gap: 14px;
}

.method-picker-hint {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
  border: 1px solid #dbeafe;
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
}

.method-picker-footer {
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

.picker-btn.ghost {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
}

.picker-btn.ghost:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.picker-btn.primary {
  border: 0;
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgb(37 99 235 / 28%);
}

.picker-btn.primary:hover {
  box-shadow: 0 4px 12px rgb(37 99 235 / 35%);
}
</style>

<template>
  <a-card class="method-selector-card" :class="{ compact }" :bordered="false">
    <template #title>
      <div class="section-title">
        <strong>麻醉方式选择</strong>
        <span>主方式单选，辅助方式可叠加</span>
      </div>
    </template>

    <div class="selector-layout">
      <section>
        <div class="selector-label">主要麻醉方式</div>
        <a-radio-group :model-value="primary" class="method-radio-grid" @change="handlePrimaryChange">
          <a-radio v-for="option in anesthesiaMethodOptions" :key="option.key" :value="option.key">
            <strong>{{ option.label }}</strong>
            <span>{{ option.description }}</span>
          </a-radio>
        </a-radio-group>
      </section>

      <section>
        <div class="selector-label">辅助麻醉方式</div>
        <a-checkbox-group :model-value="auxiliary" class="method-checkbox-grid" @change="handleAuxiliaryChange">
          <a-checkbox v-for="option in anesthesiaMethodOptions" :key="option.key" :value="option.key" :disabled="option.key === primary">
            {{ option.label }}
          </a-checkbox>
        </a-checkbox-group>
      </section>
    </div>

    <div class="selected-methods">
      <span>当前组合</span>
      <a-tag v-for="method in selectedMethods" :key="method.key" color="arcoblue">{{ method.label }}</a-tag>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { anesthesiaMethodOptions, type AnesthesiaMethodKey, type AnesthesiaMethodOption } from '@/mock/anesthesiaRecordPrototype';
import { mergeSelectedMethods } from '@/services/anesthesiaRecordMethodEngine';

const props = withDefaults(defineProps<{
  primary: AnesthesiaMethodKey;
  auxiliary: AnesthesiaMethodKey[];
  compact?: boolean;
}>(), {
  compact: false,
});

const emit = defineEmits<{
  'update:primary': [value: AnesthesiaMethodKey];
  'update:auxiliary': [value: AnesthesiaMethodKey[]];
}>();

const selectedMethods = computed(() => mergeSelectedMethods(props.primary, props.auxiliary)
  .map((key) => anesthesiaMethodOptions.find((item) => item.key === key))
  .filter((item): item is AnesthesiaMethodOption => Boolean(item)));

const handlePrimaryChange = (value: string | number | boolean) => {
  const key = value as AnesthesiaMethodKey;
  emit('update:primary', key);
  emit('update:auxiliary', props.auxiliary.filter((item) => item !== key));
};

const handleAuxiliaryChange = (value: Array<string | number | boolean>) => {
  emit('update:auxiliary', value.filter((item) => item !== props.primary) as AnesthesiaMethodKey[]);
};
</script>

<style scoped>
.method-selector-card {
  border: 1px solid #e5edf5;
}

.method-selector-card.compact {
  border: 0;
  background: transparent;
}

.method-selector-card.compact :deep(.arco-card-header) {
  display: none;
}

.method-selector-card.compact :deep(.arco-card-body) {
  padding: 0;
}

.section-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.section-title span,
.selector-label,
.selected-methods span {
  color: #64748b;
  font-size: 12px;
}

.selector-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(260px, 0.75fr);
  gap: 16px;
}

.selector-label {
  margin-bottom: 8px;
  font-weight: 600;
}

.method-radio-grid,
.method-checkbox-grid {
  display: grid;
  gap: 8px;
}

.method-radio-grid :deep(.arco-radio) {
  align-items: flex-start;
  width: 100%;
  margin: 0;
  padding: 9px 10px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: #fff;
}

.method-radio-grid :deep(.arco-radio-checked) {
  border-color: #165dff;
  background: #f6fbff;
}

.method-radio-grid :deep(.arco-radio-label) {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.method-radio-grid :deep(.arco-radio-label span) {
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
}

.method-checkbox-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.selected-methods {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #dbe6f3;
}

.method-selector-card.compact .selector-layout {
  grid-template-columns: 1fr;
  gap: 12px;
}

.method-selector-card.compact .method-radio-grid :deep(.arco-radio) {
  padding: 8px;
}

.method-selector-card.compact .method-radio-grid :deep(.arco-radio-label span) {
  display: none;
}

.method-selector-card.compact .method-checkbox-grid {
  grid-template-columns: 1fr;
}

.method-selector-card.compact .selected-methods {
  margin-top: 10px;
  padding-top: 10px;
}

@media (max-width: 1180px) {
  .selector-layout {
    grid-template-columns: 1fr;
  }
}
</style>

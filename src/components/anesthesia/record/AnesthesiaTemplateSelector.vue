<template>
  <a-card class="template-selector-card" :class="{ compact }" :bordered="false">
    <template #title>
      <div class="section-title">
        <strong>常用麻醉模板</strong>
        <a-tag v-if="selectedTemplateName" color="green">已选：{{ selectedTemplateName }}</a-tag>
      </div>
    </template>

    <div class="template-grid">
      <button
        v-for="template in anesthesiaTemplateOptions"
        :key="template.name"
        type="button"
        class="template-button"
        :class="{ active: template.name === selectedTemplateName }"
        @click="$emit('apply', template.name)"
      >
        <strong>{{ template.name }}</strong>
        <span>{{ template.description }}</span>
      </button>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { anesthesiaTemplateOptions } from '@/mock/anesthesiaRecordPrototype';

withDefaults(defineProps<{
  selectedTemplateName?: string;
  compact?: boolean;
}>(), {
  compact: false,
});

defineEmits<{
  apply: [templateName: string];
}>();
</script>

<style scoped>
.template-selector-card {
  border: 1px solid #e5edf5;
}

.template-selector-card.compact {
  border: 0;
  background: transparent;
}

.template-selector-card.compact :deep(.arco-card-header) {
  display: none;
}

.template-selector-card.compact :deep(.arco-card-body) {
  padding: 0;
}

.section-title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.template-button {
  display: grid;
  gap: 3px;
  min-height: 62px;
  padding: 9px 10px;
  border: 1px solid #e5edf5;
  border-radius: 8px;
  background: #fff;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.template-button:hover,
.template-button.active {
  border-color: #165dff;
  background: #f6fbff;
}

.template-button span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
}

.template-selector-card.compact .template-grid {
  grid-template-columns: 1fr;
}

.template-selector-card.compact .template-button {
  min-height: 48px;
  padding: 8px 10px;
  border-radius: 6px;
}

.template-selector-card.compact .template-button span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

@media (max-width: 1280px) {
  .template-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .template-grid {
    grid-template-columns: 1fr;
  }
}
</style>

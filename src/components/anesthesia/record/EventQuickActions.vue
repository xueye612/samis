<template>
  <a-card class="quick-actions-card" :class="{ compact }" :bordered="false">
    <template #title>
      <div class="section-title">
        <strong>快捷事件</strong>
        <span>点击后写入事件时间轴，仅前端模拟</span>
      </div>
    </template>

    <a-space wrap>
      <a-button
        v-for="event in visibleEvents"
        :key="event.name"
        size="small"
        :status="event.severity === '中度' || event.severity === '重度' || event.severity === '危急' ? 'danger' : 'normal'"
        :disabled="disabled"
        @click="$emit('event', event.name)"
      >
        {{ event.name }}
      </a-button>
    </a-space>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { quickEventOptions, type AnesthesiaMethodKey } from '@/mock/anesthesiaRecordPrototype';

const props = withDefaults(defineProps<{
  disabled?: boolean;
  compact?: boolean;
  methods?: AnesthesiaMethodKey[];
}>(), {
  disabled: false,
  compact: false,
  methods: () => [],
});

defineEmits<{
  event: [eventName: string];
}>();

const priorityByMethod: Record<AnesthesiaMethodKey, string[]> = {
  general: ['麻醉开始', '诱导开始', '插管', '喉罩置入', '接麻醉机', '给药', '拔管', '拔除喉罩', '麻醉结束', '离室'],
  neuraxial: ['麻醉开始', '穿刺', '给药', '置管', '平面测定', '手术开始', '麻醉结束', '离室'],
  nerveBlock: ['麻醉开始', '定位', '穿刺', '给药', '阻滞评估', '手术开始', '麻醉结束', '离室'],
  local: ['麻醉开始', '局麻', '给药', '手术开始', '麻醉结束', '离室'],
  sedation: ['麻醉开始', '镇静开始', '给药', '镇静评估', '手术开始', '麻醉结束', '离室'],
};

const visibleEvents = computed(() => {
  const priorityNames = props.methods.flatMap((method) => priorityByMethod[method] ?? []);
  const orderedNames = Array.from(new Set([...priorityNames, ...quickEventOptions.map((item) => item.name)]));
  const ordered = orderedNames
    .map((name) => quickEventOptions.find((item) => item.name === name))
    .filter((item): item is (typeof quickEventOptions)[number] => Boolean(item));
  return props.compact ? ordered.slice(0, 12) : ordered;
});
</script>

<style scoped>
.quick-actions-card {
  border: 1px solid #e5edf5;
}

.quick-actions-card.compact {
  border: 0;
  background: transparent;
}

.quick-actions-card.compact :deep(.arco-card-header) {
  display: none;
}

.quick-actions-card.compact :deep(.arco-card-body) {
  padding: 0;
}

.section-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.section-title span {
  color: #64748b;
  font-size: 12px;
}

.quick-actions-card.compact :deep(.arco-space) {
  gap: 6px !important;
}
</style>

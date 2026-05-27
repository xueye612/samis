<template>
  <a-card ref="listCardRef" class="indicator-list-card" :bordered="false" :style="panelStyle">
    <div class="panel-head">
      <span class="panel-head__title">
        <icon-unordered-list />
        指标列表
      </span>
      <span class="panel-head__hint">点击切换右侧详情</span>
    </div>

    <div class="indicator-list-toolbar">
      <a-input-search v-model="keyword" placeholder="搜索指标名称/编码" allow-clear>
        <template #prefix><icon-search /></template>
      </a-input-search>
      <div class="list-options">
        <a-checkbox v-model="showTrend">趋势</a-checkbox>
        <a-checkbox v-model="showCompare">同比环比</a-checkbox>
      </div>
    </div>

    <div class="indicator-group-bar">
      <a-tag color="arcoblue">
        <template #icon><icon-bar-chart /></template>
        共 {{ sortedIndicators.length }} 项
      </a-tag>
      <a-tag v-if="abnormalCount" color="red">
        <template #icon><icon-exclamation-circle /></template>
        异常 {{ abnormalCount }}
      </a-tag>
    </div>

    <div class="indicator-list">
      <IndicatorCard
        v-for="item in sortedIndicators"
        :key="item.code"
        :detail="item"
        :active="item.code === selectedCode"
        :show-trend="showTrend"
        :show-compare="showCompare"
        @select="$emit('select', $event)"
        @toggle-favorite="$emit('toggleFavorite', $event)"
      />
      <a-empty v-if="!sortedIndicators.length">
        <template #description>
          <div>当前「指标分类」下没有指标项</div>
          <div class="empty-hint">请切换为「全部」查看 26 项；分类只影响左侧列表，不隐藏病例数据。</div>
        </template>
      </a-empty>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import IndicatorCard from '@/components/quality/IndicatorCard.vue';
import type { IndicatorDetail } from '@/types/quality';

const props = defineProps<{ indicators: IndicatorDetail[]; selectedCode: string }>();
defineEmits<{ select: [code: string]; toggleFavorite: [code: string] }>();

const keyword = ref('');
const showTrend = ref(true);
const showCompare = ref(true);
const listCardRef = ref<HTMLElement | { $el: HTMLElement }>();
const panelMaxHeight = ref(520);
let resizeObserver: ResizeObserver | undefined;

const panelStyle = computed(() => ({ '--indicator-panel-max-height': `${panelMaxHeight.value}px` }));

const abnormalCount = computed(() => props.indicators.filter((item) => item.status === 'abnormal').length);
const sortedIndicators = computed(() => {
  const word = keyword.value.trim().toLowerCase();
  return [...props.indicators]
    .filter((item) => !word || `${item.name}${item.code}`.toLowerCase().includes(word))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || Number(b.status === 'abnormal') - Number(a.status === 'abnormal') || a.code.localeCompare(b.code));
});

const resolveCardElement = () => {
  const current = listCardRef.value;
  if (!current) return undefined;
  return current instanceof HTMLElement ? current : current.$el;
};

const updatePanelHeight = async () => {
  await nextTick();
  const el = resolveCardElement();
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  panelMaxHeight.value = Math.max(320, Math.floor(window.innerHeight - top - 18));
};

onMounted(() => {
  updatePanelHeight();
  const el = resolveCardElement();
  if (el) {
    resizeObserver = new ResizeObserver(updatePanelHeight);
    resizeObserver.observe(document.body);
    resizeObserver.observe(el);
  }
  window.addEventListener('resize', updatePanelHeight);
  window.addEventListener('scroll', updatePanelHeight, { passive: true });
});

watch([keyword, showTrend, showCompare, sortedIndicators], updatePanelHeight);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('resize', updatePanelHeight);
  window.removeEventListener('scroll', updatePanelHeight);
});
</script>

<style scoped>
.indicator-list-card {
  min-height: 0;
  max-height: var(--indicator-panel-max-height);
  border: 1px solid #dfe7ef;
  overflow: hidden;
}

.indicator-list-card :deep(.arco-card-body) {
  min-height: 0;
  max-height: var(--indicator-panel-max-height);
  display: flex;
  flex-direction: column;
  padding: 12px;
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.panel-head__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: #1a2e2e;
}

.panel-head__title .arco-icon {
  color: #0d6e6e;
}

.panel-head__hint {
  font-size: 12px;
  color: #5c7373;
}

.indicator-list-toolbar {
  display: grid;
  gap: 10px;
  margin-bottom: 10px;
}

.list-options,
.indicator-group-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.indicator-group-bar {
  margin-bottom: 10px;
}

.indicator-list {
  min-height: 0;
  max-height: calc(var(--indicator-panel-max-height) - 116px);
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 6px;
  display: grid;
  gap: 8px;
  scrollbar-gutter: stable;
}

.indicator-list::-webkit-scrollbar {
  width: 8px;
}

.indicator-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: #c8d5e3;
}

.empty-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #86909c;
}

@media (max-width: 1200px) {
  .indicator-list {
    max-height: calc(var(--indicator-panel-max-height) - 116px);
  }
}
</style>

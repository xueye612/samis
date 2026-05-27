<template>
  <button class="indicator-card" :class="[detail.status, { active }]" type="button" @click="$emit('select', detail.code)">
    <span class="status-rail" aria-hidden="true"></span>
    <span class="favorite" :class="{ active: detail.favorite }" @click.stop="$emit('toggleFavorite', detail.code)">
      <icon-star-fill v-if="detail.favorite" />
      <icon-star v-else />
    </span>

    <span class="indicator-body">
      <span class="indicator-name" :title="detail.name">{{ detail.name }}</span>
      <span class="indicator-code">
        <component :is="categoryIcon" class="category-icon" />
        {{ detail.code }} · {{ categoryLabel }}
      </span>
      <span v-if="showTrend" class="mini-trend" aria-hidden="true">
        <span v-for="(point, index) in bars" :key="index" :style="{ height: `${point}px` }"></span>
      </span>
      <span v-else class="mini-trend placeholder"></span>
    </span>

    <span class="indicator-value">
      <strong :title="detail.displayValue">{{ detail.displayValue }}</strong>
      <a-tag class="status-tag" :color="statusColor" size="small">{{ statusText }}</a-tag>
      <span v-if="showCompare" class="compare-line demo-compare" :class="{ good: detail.yoy >= 0, bad: detail.yoy < 0 }">同比 {{ detail.yoy }}%·演示</span>
      <span v-if="showCompare" class="compare-line demo-compare" :class="{ good: detail.mom >= 0, bad: detail.mom < 0 }">环比 {{ detail.mom }}%·演示</span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import {
  IconApps,
  IconExclamationCircleFill,
  IconHeartFill,
  IconExperiment,
  IconThunderbolt,
  IconUserGroup,
} from '@arco-design/web-vue/es/icon';
import { qualityCategoryLabels, type IndicatorDetail, type QualityCategory, type QualityStatus } from '@/types/quality';

const categoryIconMap: Record<QualityCategory, Component> = {
  structure: IconApps,
  process: IconThunderbolt,
  outcome: IconExclamationCircleFill,
  pacu: IconHeartFill,
  postoperative: IconExperiment,
  obstetric: IconUserGroup,
};

const props = defineProps<{
  detail: IndicatorDetail;
  active: boolean;
  showTrend: boolean;
  showCompare: boolean;
}>();

defineEmits<{ select: [code: string]; toggleFavorite: [code: string] }>();

const statusMap: Record<QualityStatus, { text: string; color: string }> = {
  normal: { text: '正常', color: 'green' },
  warning: { text: '预警', color: 'orange' },
  abnormal: { text: '异常', color: 'red' },
  'no-data': { text: '暂无', color: 'gray' },
};

const categoryLabel = computed(() => qualityCategoryLabels[props.detail.category]);
const categoryIcon = computed(() => categoryIconMap[props.detail.category]);
const statusText = computed(() => statusMap[props.detail.status].text);
const statusColor = computed(() => statusMap[props.detail.status].color);
const bars = computed(() => {
  const values = props.detail.trend.slice(-12).map((item) => item.value);
  const max = Math.max(1, ...values);
  return values.map((value) => Math.max(5, Math.round((value / max) * 26)));
});
</script>

<style scoped>
.indicator-card {
  position: relative;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 104px;
  gap: 10px;
  width: 100%;
  min-height: 98px;
  padding: 10px 12px 10px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background 0.16s ease;
}

.indicator-card:hover {
  border-color: var(--color-brand-200);
  background: var(--primary-soft);
}

.indicator-card.active {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.status-rail {
  position: absolute;
  inset: 9px auto 9px 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: transparent;
}

.indicator-card.abnormal .status-rail {
  background: var(--danger);
}

.indicator-card.warning .status-rail {
  background: var(--warning);
}

.favorite {
  align-self: start;
  justify-self: center;
  display: inline-flex;
  color: var(--text-tertiary);
  font-size: 16px;
  line-height: 1;
}

.favorite.active {
  color: var(--warning);
}

.indicator-body {
  min-width: 0;
  display: grid;
  grid-template-rows: minmax(34px, auto) 18px 28px;
  row-gap: 4px;
}

.indicator-name {
  display: -webkit-box;
  overflow: hidden;
  font-size: 14px;
  font-weight: 700;
  line-height: 17px;
  color: var(--text-primary);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  word-break: break-word;
}

.indicator-code {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-icon {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--medical-cyan);
}

.mini-trend {
  height: 28px;
  display: flex;
  align-items: end;
  gap: 3px;
  overflow: hidden;
}

.mini-trend span {
  width: 5px;
  max-height: 26px;
  flex: 0 0 5px;
  border-radius: 2px 2px 0 0;
  background: var(--medical-cyan);
}

.mini-trend.placeholder {
  background: linear-gradient(180deg, transparent, var(--surface-muted));
}

.indicator-value {
  width: 104px;
  min-width: 104px;
  display: grid;
  justify-items: end;
  align-content: start;
  row-gap: 4px;
}

.indicator-value strong {
  max-width: 104px;
  overflow: hidden;
  color: var(--primary);
  font-size: 18px;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-tag {
  margin-right: 0;
}

.compare-line {
  max-width: 104px;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-line.good {
  color: var(--color-success-600);
}

.compare-line.bad {
  color: var(--danger);
}
</style>

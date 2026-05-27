<template>
  <a-card class="definition-card" :bordered="false">
    <template #title>
      <div class="definition-title">
        <a-tag color="arcoblue">{{ detail.metricCode }}</a-tag>
        <span :title="detail.metricName">{{ detail.metricName }}</span>
      </div>
    </template>

    <p class="interpretation">
      <span class="section-icon"><icon-info-circle /></span>
      {{ detail.description }}
    </p>

    <div class="formula-block">
      <span>计算口径</span>
      <strong>{{ detail.formulaText }}</strong>
      <small>{{ normalizedExpression }}</small>
    </div>

    <div class="definition-list">
      <div>
        <span>计入对象</span>
        <strong>{{ detail.numeratorLabel }}</strong>
      </div>
      <div>
        <span>统计范围</span>
        <strong>{{ detail.denominatorLabel }}</strong>
      </div>
      <div>
        <span>当前表达式</span>
        <strong>{{ normalizedExpression }}</strong>
      </div>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IndicatorDetail } from '@/types/quality';

const props = defineProps<{ detail: IndicatorDetail }>();
const normalizedExpression = computed(() => props.detail.formulaExpression.replace(/脳/g, '×').replace(/鈥\?/g, '‰'));
</script>

<style scoped>
.definition-card {
  border: 1px solid #dfe7ef;
  background: #fff;
  height: 100%;
}

.definition-card :deep(.arco-card-header) {
  min-height: 48px;
  padding: 12px 14px;
}

.definition-card :deep(.arco-card-body) {
  padding: 12px 14px 14px;
}

.definition-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.definition-title span:last-child {
  min-width: 0;
  overflow: hidden;
  color: #16324f;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.interpretation {
  display: -webkit-box;
  overflow: hidden;
  margin: 0 0 10px;
  padding: 9px 10px;
  border-radius: 8px;
  background: #f5f8fc;
  color: #405064;
  font-size: 13px;
  line-height: 20px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.formula-block {
  min-width: 0;
  padding: 10px;
  border: 1px solid #edf2f7;
  border-radius: 7px;
  background: #fbfdff;
  margin-bottom: 10px;
}

.formula-block span,
.definition-list span {
  display: block;
  color: #667085;
  font-size: 12px;
  line-height: 17px;
}

.formula-block strong,
.definition-list strong {
  display: block;
  overflow-wrap: anywhere;
  color: #1d2733;
  font-size: 13px;
  line-height: 19px;
  font-weight: 600;
}

.formula-block strong {
  margin: 4px 0;
}

.formula-block small {
  display: block;
  overflow-wrap: anywhere;
  color: #0f5ca8;
  font-size: 12px;
  line-height: 18px;
}

.definition-list {
  display: grid;
  gap: 8px;
}

.definition-list div {
  min-width: 0;
}
</style>

<template>
  <div class="kpi-summary">
    <div class="kpi-card primary">
      <span class="kpi-label"><icon-dashboard /> 当前指标值</span>
      <div class="primary-row">
        <strong>{{ detail.displayValue }}</strong>
        <a-tag :color="status.color">{{ status.text }}</a-tag>
      </div>
      <small>{{ detail.description }}</small>
      <div class="scope-row">
        <span :title="detail.numeratorLabel">{{ detail.numeratorLabel }}：{{ detail.numeratorValue }}</span>
        <span :title="detail.denominatorLabel">{{ detail.denominatorLabel }}：{{ detail.denominatorValue }}</span>
      </div>
    </div>

    <div class="kpi-card status-card" :class="detail.currentStatus">
      <span class="kpi-label"><icon-check-circle /> 状态</span>
      <strong :class="detail.currentStatus">{{ status.text }}</strong>
      <small>{{ status.hint }}</small>
    </div>

    <div class="kpi-card compare demo-metric">
      <span class="kpi-label"><icon-arrow-rise /> 同比 <em class="demo-tag">演示</em></span>
      <strong :class="detail.yoyValue >= 0 ? 'positive' : 'negative'">
        <span>{{ detail.yoyValue >= 0 ? '↑' : '↓' }}</span>{{ Math.abs(detail.yoyValue) }}%
      </strong>
      <small>{{ detail.yoyLabel }}</small>
    </div>

    <div class="kpi-card compare demo-metric">
      <span class="kpi-label"><icon-swap /> 环比 <em class="demo-tag">演示</em></span>
      <strong :class="detail.momValue >= 0 ? 'positive' : 'negative'">
        <span>{{ detail.momValue >= 0 ? '↑' : '↓' }}</span>{{ Math.abs(detail.momValue) }}%
      </strong>
      <small>{{ detail.momLabel }}</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IndicatorDetail, QualityStatus } from '@/types/quality';

const props = defineProps<{ detail: IndicatorDetail }>();

const statusMap: Record<QualityStatus, { text: string; color: string; hint: string }> = {
  normal: { text: '正常', color: 'green', hint: '当前处于可接受范围' },
  warning: { text: '预警', color: 'orange', hint: '建议关注趋势和异常病例' },
  abnormal: { text: '异常', color: 'red', hint: '需要尽快复核并整改' },
  'no-data': { text: '暂无数据', color: 'gray', hint: '当前周期无可统计对象' },
};

const status = computed(() => statusMap[props.detail.currentStatus]);
</script>

<style scoped>
.kpi-summary {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 112px 118px 118px;
  gap: 10px;
  align-items: stretch;
}

.kpi-card {
  min-width: 0;
  min-height: 108px;
  padding: 12px 14px;
  border: 1px solid #dfe7ef;
  border-radius: 8px;
  background: #fff;
}

.kpi-card.primary {
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
  border-color: #cfe4ff;
}

.kpi-label,
.kpi-card small {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #667085;
  font-size: 12px;
  line-height: 17px;
}

.kpi-label :deep(.arco-icon) {
  font-size: 14px;
  color: #14a3a3;
}

.primary-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 5px 0 4px;
}

.kpi-card strong {
  display: block;
  overflow: hidden;
  color: #0f5ca8;
  font-size: 21px;
  line-height: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.primary strong {
  font-size: 32px;
  line-height: 38px;
}

.primary small {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.scope-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 7px;
}

.scope-row span {
  min-width: 0;
  overflow: hidden;
  padding: 4px 6px;
  border-radius: 5px;
  background: #eef6ff;
  color: #405064;
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-card strong.normal {
  color: #0f9f6e;
}

.status-card strong.warning {
  color: #f97316;
}

.status-card strong.abnormal {
  color: #dc2626;
}

.compare strong {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 5px;
}

.compare strong.positive {
  color: #0f9f6e;
}

.compare strong.negative {
  color: #dc2626;
}

@media (max-width: 1250px) {
  .kpi-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .kpi-summary {
    grid-template-columns: 1fr;
  }
}
</style>

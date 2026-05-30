<template>
  <ModulePageShell title="工作量统计" description="手术量、麻醉方式与类型分布分析">
    <template #toolbar>
      <a-space>
        <a-radio-group v-model="timeRange" type="button">
          <a-radio value="今日">今日</a-radio>
          <a-radio value="本周">本周</a-radio>
          <a-radio value="本月">本月</a-radio>
        </a-radio-group>
        <a-button type="primary" @click="store.exportWorkloadCsv()">
          <template #icon><icon-download /></template>
          导出 CSV
        </a-button>
      </a-space>
    </template>
    <template #stats>
      <MetricCard label="手术总数" :value="stats.totalSurgeries" icon="IconCalendar" />
      <MetricCard label="麻醉总数" :value="stats.totalAnesthesia" icon="IconExperiment" />
      <MetricCard label="急诊" :value="stats.emergencyCount" tag="急诊" variant="danger" icon="IconExclamationCircle" />
      <MetricCard label="择期" :value="stats.electiveCount" icon="IconFile" />
      <MetricCard label="完成率" :value="`${stats.completionRate}%`" tag="统计" icon="IconCheckCircle" />
    </template>
    <div class="chart-grid">
      <a-card class="section-card" :bordered="false" title="工作量趋势">
        <SimpleChart type="line" :labels="stats.trendLabels" :values="stats.trendValues" series-name="手术量" />
      </a-card>
      <a-card class="section-card" :bordered="false" title="手术类型分布">
        <SimpleChart type="bar" :labels="stats.typeLabels" :values="stats.typeValues" series-name="台数" />
      </a-card>
      <a-card class="section-card" :bordered="false" title="麻醉方式占比">
        <SimpleChart type="pie" :labels="stats.methodLabels" :values="stats.methodValues" />
      </a-card>
    </div>
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import { IconDownload } from '@arco-design/web-vue/es/icon';
import MetricCard from '@/components/MetricCard.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import SimpleChart from '@/components/shared/SimpleChart.vue';
import { buildWorkloadStats } from '@/mock/clinicalModulesSeed';
import { useAnesthesiaStore } from '@/stores/anesthesia';

type TimeRange = '今日' | '本周' | '本月';

const store = useAnesthesiaStore();
const timeRange = ref<TimeRange>('今日');

const stats = computed(() => {
  const now = dayjs();
  const cases = store.cases.filter((item) => {
    const start = dayjs(item.plannedStart ?? item.scheduledStart);
    if (timeRange.value === '今日') return start.isSame(now, 'day');
    if (timeRange.value === '本周') return start.isSame(now, 'week');
    return start.isSame(now, 'month');
  });
  if (timeRange.value === '本月' && cases.length === store.cases.length) {
    return store.workloadStats ?? buildWorkloadStats(cases);
  }
  return buildWorkloadStats(cases);
});
</script>

<style scoped>
.chart-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 1200px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>

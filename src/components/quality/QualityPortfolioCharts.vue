<template>
  <div class="portfolio-grid">
    <a-card title="指标状态分布" class="section-card" :bordered="false">
      <a-empty v-if="!statusRows.length" description="当前范围无真实指标数据" />
      <div v-else ref="statusChartRef" class="portfolio-chart"></div>
    </a-card>
    <a-card title="分类覆盖与异常" class="section-card" :bordered="false">
      <a-empty v-if="!categoryRows.length" description="当前范围无分类数据" />
      <div v-else ref="categoryChartRef" class="portfolio-chart"></div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { QualityCategorySummary } from '@/services/quality/qualityDashboardPresentation';

const props = defineProps<{
  statusRows: Array<{ key: string; label: string; value: number }>;
  categoryRows: QualityCategorySummary[];
}>();

const statusChartRef = ref<HTMLDivElement>();
const categoryChartRef = ref<HTMLDivElement>();
let statusChart: echarts.ECharts | undefined;
let categoryChart: echarts.ECharts | undefined;

async function render() {
  await nextTick();
  if (statusChartRef.value && props.statusRows.length) {
    statusChart ??= echarts.init(statusChartRef.value);
    statusChart.setOption({
      color: ['#22a06b', '#f7ba1e', '#f53f3f', '#c9cdd4'],
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{
        name: '指标状态',
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '44%'],
        label: { formatter: '{b} {c}' },
        data: props.statusRows.map((row) => ({ name: row.label, value: row.value })),
      }],
    }, true);
  }
  if (categoryChartRef.value && props.categoryRows.length) {
    categoryChart ??= echarts.init(categoryChartRef.value);
    categoryChart.setOption({
      color: ['#165dff', '#f53f3f'],
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, data: ['有数据', '异常/预警'] },
      grid: { left: 38, right: 16, top: 42, bottom: 28, containLabel: true },
      xAxis: { type: 'category', data: props.categoryRows.map((row) => row.label) },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        { name: '有数据', type: 'bar', barMaxWidth: 32, data: props.categoryRows.map((row) => row.withData) },
        { name: '异常/预警', type: 'bar', barMaxWidth: 32, data: props.categoryRows.map((row) => row.abnormal) },
      ],
    }, true);
  }
}

const resize = () => { statusChart?.resize(); categoryChart?.resize(); };
watch(() => [props.statusRows, props.categoryRows], render, { deep: true });
onMounted(() => { render(); window.addEventListener('resize', resize); });
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize);
  statusChart?.dispose();
  categoryChart?.dispose();
});
</script>

<style scoped>
.portfolio-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.portfolio-chart { width: 100%; height: 280px; }
@media (max-width: 980px) { .portfolio-grid { grid-template-columns: 1fr; } }
</style>

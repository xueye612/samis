<template>
  <div ref="chartRef" class="simple-chart" :style="{ height: `${height}px` }"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import { qualityChartPalette } from '@/config/echartsTheme';

const props = withDefaults(
  defineProps<{
    type: 'line' | 'bar' | 'pie';
    labels: string[];
    values: number[];
    seriesName?: string;
    height?: number;
  }>(),
  { seriesName: '数量', height: 280 },
);

const chartRef = ref<HTMLDivElement>();
let chart: echarts.ECharts | undefined;

const render = () => {
  if (!chartRef.value) return;
  chart ??= echarts.init(chartRef.value);
  if (props.type === 'pie') {
    chart.setOption({
      color: [qualityChartPalette.primary, qualityChartPalette.secondary, qualityChartPalette.accent],
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie',
        radius: ['40%', '65%'],
        data: props.labels.map((name, i) => ({ name, value: props.values[i] ?? 0 })),
      }],
    });
    return;
  }
  chart.setOption({
    color: [qualityChartPalette.primary],
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 24, top: 24, bottom: 32 },
    xAxis: { type: 'category', data: props.labels },
    yAxis: { type: 'value' },
    series: [{ name: props.seriesName, type: props.type, smooth: props.type === 'line', data: props.values, barMaxWidth: 28 }],
  });
};

onMounted(render);
watch(() => [props.labels, props.values, props.type], render, { deep: true });
onBeforeUnmount(() => chart?.dispose());
</script>

<style scoped>
.simple-chart {
  width: 100%;
}
</style>

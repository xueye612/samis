<template>
  <div class="trend-chart-wrap" :class="{ compact }">
    <a-empty v-if="!hasData" description="暂无图表数据" />
    <div v-show="hasData" ref="chartRef" class="indicator-chart" :style="{ height: `${chartHeight}px` }"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import type { IndicatorDetail, QualityChartSection, QualitySectionChartType } from '@/types/quality';
import { buildAxisStyle, buildGrid, qualityChartPalette } from '@/config/echartsTheme';

const props = defineProps<{ detail: IndicatorDetail; compact?: boolean; section?: QualityChartSection }>();
const chartRef = ref<HTMLDivElement>();
let chart: echarts.ECharts | undefined;
let resizeObserver: ResizeObserver | undefined;

const activeSection = computed(() => props.section ?? 'yearTrend');
const hasData = computed(
  () =>
    props.detail.trendData.length > 0 ||
    props.detail.yearTrendData.length > 0 ||
    props.detail.quarterCompareData.length > 0 ||
    props.detail.monthGrowthData.length > 0 ||
    props.detail.dimensionDistributionData.length > 0,
);
const chartHeight = computed(() => {
  if (props.compact) return 28;
  if (activeSection.value === 'yearTrend') return 330;
  if (activeSection.value === 'dimensionDistribution') return 280;
  return 250;
});
const unitSuffix = computed(() => (props.detail.unit === '%' || props.detail.unit === '‰' ? props.detail.unit : ''));
const formatMetric = (value: number) => `${value}${unitSuffix.value}`;

const trendMonths = () => props.detail.trendData.map((item) => item.month);
const metricValues = () => props.detail.trendData.map((item) => item.value);
const includedValues = () => props.detail.trendData.map((item) => item.numeratorValue);
const scopeValues = () => props.detail.trendData.map((item) => item.denominatorValue);
const activeYearData = () => props.detail.yearTrendData.length ? props.detail.yearTrendData : props.detail.trendData;
const targetMarkLine = () =>
  props.detail.showTargetLine && typeof props.detail.targetValue === 'number'
    ? {
        symbol: 'none',
        label: { formatter: `目标 ${props.detail.targetValue}${unitSuffix.value}` },
        lineStyle: { color: qualityChartPalette.accent, type: 'dashed', width: 2 },
        data: [{ yAxis: props.detail.targetValue }],
      }
    : undefined;

const baseGrid = {
  left: props.compact ? 0 : 48,
  right: props.compact ? 0 : 54,
  top: props.compact ? 2 : 56,
  bottom: props.compact ? 2 : 34,
  containLabel: !props.compact,
};
const axisStyle = buildAxisStyle();

const comboOption = () => ({
  color: [qualityChartPalette.primary, qualityChartPalette.secondary, qualityChartPalette.accent],
  tooltip: { trigger: 'axis' },
  legend: props.compact ? undefined : { top: 8, right: 12, data: ['指标值', props.detail.numeratorShortLabel, props.detail.denominatorShortLabel] },
  grid: baseGrid,
  xAxis: { type: 'category', show: !props.compact, data: trendMonths(), axisLabel: axisStyle.axisLabel },
  yAxis: props.compact
    ? { type: 'value', show: false }
    : [
        { type: 'value', name: props.detail.unit === 'count' ? '次数' : props.detail.unit, axisLabel: { formatter: (value: number) => formatMetric(value), color: axisStyle.axisLabel.color }, splitLine: axisStyle.splitLine },
        { type: 'value', name: '数量', axisLabel: axisStyle.axisLabel, splitLine: { show: false } },
      ],
  series: [
    { name: '指标值', type: 'line', yAxisIndex: 0, smooth: true, symbol: props.compact ? 'none' : 'circle', symbolSize: 6, lineStyle: { width: 3 }, data: metricValues() },
    ...(props.compact
      ? []
      : [
          { name: props.detail.numeratorShortLabel, type: 'bar', yAxisIndex: 1, barMaxWidth: 18, data: includedValues() },
          { name: props.detail.denominatorShortLabel, type: 'bar', yAxisIndex: 1, barMaxWidth: 18, data: scopeValues() },
        ]),
  ],
});

const areaOption = (useTarget = false) => ({
  color: [qualityChartPalette.primary, qualityChartPalette.secondary],
  tooltip: { trigger: 'axis' },
  legend: { top: 8, right: 12, data: useTarget ? ['指标值'] : ['指标值', props.detail.numeratorShortLabel] },
  grid: buildGrid({ right: 28, top: 56 }),
  xAxis: { type: 'category', boundaryGap: false, data: activeYearData().map((item) => item.month), axisLabel: axisStyle.axisLabel },
  yAxis: { type: 'value', name: props.detail.unit, axisLabel: { formatter: (value: number) => formatMetric(value), color: axisStyle.axisLabel.color }, splitLine: axisStyle.splitLine },
  series: [
    { name: '指标值', type: 'line', smooth: true, symbolSize: 6, areaStyle: { opacity: 0.14 }, lineStyle: { width: 3 }, data: activeYearData().map((item) => item.value), markLine: useTarget ? targetMarkLine() : undefined },
    ...(useTarget
      ? []
      : [{ name: props.detail.numeratorShortLabel, type: 'line', smooth: true, symbol: 'none', lineStyle: { width: 2, type: 'dashed' }, data: activeYearData().map((item) => (item.denominatorValue ? Number(((item.numeratorValue / item.denominatorValue) * (props.detail.unit === '‰' ? 1000 : 100)).toFixed(1)) : 0)) }]),
  ],
});

const donutOption = () => ({
  color: [qualityChartPalette.primary, qualityChartPalette.secondary, qualityChartPalette.accent, qualityChartPalette.neutral],
  tooltip: { trigger: 'item' },
  legend: { orient: 'vertical', right: 16, top: 'middle' },
  series: [
    {
      name: props.detail.metricName,
      type: 'pie',
      radius: ['48%', '70%'],
      center: ['38%', '52%'],
      avoidLabelOverlap: true,
      label: { formatter: '{b}\n{c}' },
      data: props.detail.compositionData,
    },
  ],
  graphic: [{ type: 'text', left: '31%', top: '47%', style: { text: props.detail.displayValue, fill: qualityChartPalette.primary, fontSize: 24, fontWeight: 700, textAlign: 'center' } }],
});

const horizontalBarOption = () => ({
  color: [qualityChartPalette.primary],
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: buildGrid({ left: 110, right: 28, top: 24, bottom: 24 }),
  xAxis: { type: 'value', axisLabel: axisStyle.axisLabel, splitLine: axisStyle.splitLine },
  yAxis: { type: 'category', data: props.detail.rankingData.map((item) => item.name).reverse(), axisLabel: axisStyle.axisLabel },
  series: [{ name: '指标值', type: 'bar', barMaxWidth: 18, data: props.detail.rankingData.map((item) => item.value).reverse(), label: { show: true, position: 'right', formatter: (params: { value: number }) => formatMetric(params.value) } }],
});

const groupedBarOption = () => ({
  color: [qualityChartPalette.primary, qualityChartPalette.secondary],
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: { top: 8, right: 12, data: [props.detail.numeratorShortLabel, props.detail.denominatorShortLabel] },
  grid: buildGrid({ left: 44, top: 56, bottom: 36 }),
  xAxis: { type: 'category', data: props.detail.rankingData.map((item) => item.name), axisLabel: axisStyle.axisLabel },
  yAxis: { type: 'value', axisLabel: axisStyle.axisLabel, splitLine: axisStyle.splitLine },
  series: [
    { name: props.detail.numeratorShortLabel, type: 'bar', barMaxWidth: 18, data: props.detail.rankingData.map((item) => item.numeratorValue) },
    { name: props.detail.denominatorShortLabel, type: 'bar', barMaxWidth: 18, data: props.detail.rankingData.map((item) => item.denominatorValue) },
  ],
});

const lineOption = () => ({
  color: [qualityChartPalette.primary],
  tooltip: { trigger: 'axis' },
  grid: buildGrid(),
  xAxis: { type: 'category', data: activeYearData().map((item) => item.month), axisLabel: axisStyle.axisLabel },
  yAxis: { type: 'value', name: props.detail.unit === 'count' ? '次数' : props.detail.unit, axisLabel: { formatter: (value: number) => formatMetric(value), color: axisStyle.axisLabel.color }, splitLine: axisStyle.splitLine },
  series: [{ name: '指标值', type: 'line', smooth: true, symbolSize: 6, lineStyle: { width: 3 }, data: activeYearData().map((item) => item.value) }],
});

const stackedYearOption = () => ({
  color: [qualityChartPalette.primary, qualityChartPalette.secondary],
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: { top: 8, right: 12, data: [props.detail.numeratorShortLabel, props.detail.denominatorShortLabel] },
  grid: buildGrid({ left: 44, top: 52 }),
  xAxis: { type: 'category', data: activeYearData().map((item) => item.month), axisLabel: axisStyle.axisLabel },
  yAxis: { type: 'value', axisLabel: axisStyle.axisLabel, splitLine: axisStyle.splitLine },
  series: [
    { name: props.detail.numeratorShortLabel, type: 'bar', stack: 'total', barMaxWidth: 18, data: activeYearData().map((item) => item.numeratorValue) },
    { name: props.detail.denominatorShortLabel, type: 'bar', stack: 'total', barMaxWidth: 18, data: activeYearData().map((item) => item.denominatorValue) },
  ],
});

const abnormalYearOption = () => ({
  color: [qualityChartPalette.accent],
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: buildGrid({ left: 44, top: 34 }),
  xAxis: { type: 'category', data: activeYearData().map((item) => item.month), axisLabel: axisStyle.axisLabel },
  yAxis: { type: 'value', name: '异常例数', axisLabel: axisStyle.axisLabel, splitLine: axisStyle.splitLine },
  series: [{ name: props.detail.numeratorShortLabel, type: 'bar', barMaxWidth: 18, data: activeYearData().map((item) => item.numeratorValue) }],
});


const quarterOption = (chartType: QualitySectionChartType) => {
  const quarters = props.detail.quarterCompareData;
  const useStacks = chartType === 'stackedBar';
  return {
    color: useStacks ? [qualityChartPalette.primary, qualityChartPalette.secondary] : [qualityChartPalette.primary],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: useStacks ? { top: 8, right: 12, data: [props.detail.numeratorShortLabel, props.detail.denominatorShortLabel] } : undefined,
    grid: buildGrid({ left: 44, top: useStacks ? 52 : 34 }),
    xAxis: { type: 'category', data: quarters.map((item) => item.quarter), axisLabel: axisStyle.axisLabel },
    yAxis: { type: 'value', name: chartType === 'abnormalBar' ? '例数' : props.detail.unit, axisLabel: { formatter: (value: number) => (chartType === 'abnormalBar' ? `${value}` : formatMetric(value)), color: axisStyle.axisLabel.color }, splitLine: axisStyle.splitLine },
    series: useStacks
      ? [
          { name: props.detail.numeratorShortLabel, type: 'bar', stack: 'total', barMaxWidth: 26, data: quarters.map((item) => item.numeratorValue) },
          { name: props.detail.denominatorShortLabel, type: 'bar', stack: 'total', barMaxWidth: 26, data: quarters.map((item) => item.denominatorValue) },
        ]
      : [{ name: chartType === 'abnormalBar' ? props.detail.numeratorShortLabel : '指标值', type: 'bar', barMaxWidth: 28, data: quarters.map((item) => (chartType === 'abnormalBar' ? item.numeratorValue : item.value)), markLine: chartType === 'barTarget' ? targetMarkLine() : undefined }],
  };
};

const growthOption = () => ({
  color: [qualityChartPalette.primary],
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: buildGrid({ left: 44, top: 32, bottom: 36 }),
  xAxis: { type: 'category', data: props.detail.monthGrowthData.map((item) => item.month), axisLabel: axisStyle.axisLabel },
  yAxis: { type: 'value', name: '环比变化', axisLabel: { formatter: (value: number) => formatMetric(value), color: axisStyle.axisLabel.color }, splitLine: axisStyle.splitLine },
  series: [
    {
      name: '环比变化',
      type: 'bar',
      barMaxWidth: 18,
      data: props.detail.monthGrowthData.map((item) => ({
        value: item.changeValue,
        itemStyle: { color: item.isImproved ? qualityChartPalette.positive : qualityChartPalette.negative },
      })),
    },
  ],
});

const distributionOption = () => {
  const rows = props.detail.dimensionDistributionData;
  if (props.detail.distributionChartType === 'groupedBar') {
    return {
      color: [qualityChartPalette.primary, qualityChartPalette.secondary],
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 8, right: 12, data: [props.detail.numeratorShortLabel, props.detail.denominatorShortLabel] },
      grid: buildGrid({ left: 44, right: 20, top: 52, bottom: 42 }),
      xAxis: { type: 'category', data: rows.map((item) => item.name), axisLabel: axisStyle.axisLabel },
      yAxis: { type: 'value', axisLabel: axisStyle.axisLabel, splitLine: axisStyle.splitLine },
      series: [
        { name: props.detail.numeratorShortLabel, type: 'bar', barMaxWidth: 18, data: rows.map((item) => item.numeratorValue) },
        { name: props.detail.denominatorShortLabel, type: 'bar', barMaxWidth: 18, data: rows.map((item) => item.denominatorValue) },
      ],
    };
  }

  return {
    color: [qualityChartPalette.primary, qualityChartPalette.secondary],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: buildGrid({ left: 96, right: 30, top: 24, bottom: 24 }),
    xAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatMetric(value), color: axisStyle.axisLabel.color }, splitLine: axisStyle.splitLine },
    yAxis: { type: 'category', data: rows.map((item) => item.name).reverse(), axisLabel: axisStyle.axisLabel },
    series: props.detail.distributionChartType === 'stackedHorizontalBar'
      ? [
          { name: props.detail.numeratorShortLabel, type: 'bar', stack: 'total', data: rows.map((item) => item.numeratorValue).reverse() },
          { name: props.detail.denominatorShortLabel, type: 'bar', stack: 'total', data: rows.map((item) => item.denominatorValue).reverse() },
        ]
      : [{ name: '指标值', type: 'bar', barMaxWidth: 18, data: rows.map((item) => item.value).reverse(), label: { show: true, position: 'right', formatter: (params: { value: number }) => formatMetric(params.value) } }],
  };
};

const optionByStrategy = () => {
  if (props.compact) return comboOption();
  if (activeSection.value === 'quarterCompare') return quarterOption(props.detail.quarterChartType);
  if (activeSection.value === 'monthGrowth') return growthOption();
  if (activeSection.value === 'dimensionDistribution') return distributionOption();
  if (props.detail.yearTrendChartType === 'stackedBar') return stackedYearOption();
  if (props.detail.yearTrendChartType === 'areaTarget') return areaOption(true);
  if (props.detail.yearTrendChartType === 'line') return lineOption();
  if (props.detail.yearTrendChartType === 'abnormalBar') return abnormalYearOption();
  if (props.detail.chartType === 'donut') return donutOption();
  if (props.detail.chartType === 'area') return areaOption();
  if (props.detail.chartType === 'horizontalBar') return horizontalBarOption();
  if (props.detail.chartType === 'groupedBar') return groupedBarOption();
  return comboOption();
};

const render = async () => {
  await nextTick();
  if (!chartRef.value || !hasData.value) return;
  chart ??= echarts.init(chartRef.value);
  chart.setOption(optionByStrategy(), true);
  chart.resize();
};

const resize = () => chart?.resize();

onMounted(() => {
  render();
  if (chartRef.value) {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(chartRef.value);
  }
  window.addEventListener('resize', resize);
});

watch(
  () => [
    props.detail.metricCode,
    props.detail.chartType,
    props.detail.yearTrendChartType,
    props.detail.quarterChartType,
    props.detail.monthGrowthChartType,
    props.detail.distributionChartType,
    props.detail.trendData,
    props.detail.yearTrendData,
    props.detail.quarterCompareData,
    props.detail.monthGrowthData,
    props.detail.dimensionDistributionData,
    props.detail.compositionData,
    props.detail.rankingData,
    props.compact,
    props.section,
  ],
  render,
  { deep: true },
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener('resize', resize);
  chart?.dispose();
});
</script>

<style scoped>
.trend-chart-wrap {
  width: 100%;
  min-width: 0;
}

.indicator-chart {
  width: 100%;
}

.compact {
  height: 28px;
  overflow: hidden;
}
</style>

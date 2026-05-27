<template>
  <div ref="chartRef" class="vitals-chart"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import type { VitalSign } from '@/types/anesthesia';
import type { VitalSignDictItem } from '@/types/system';
import { anesthesiaChartPalette, buildAxisStyle, buildGrid } from '@/config/echartsTheme';

const props = withDefaults(
  defineProps<{ vitals: VitalSign[]; enabledSeries?: VitalSignDictItem[] }>(),
  {
    enabledSeries: () => [],
  },
);

const chartRef = ref<HTMLDivElement>();
let chart: echarts.ECharts | undefined;
const axisStyle = buildAxisStyle();
const onResize = () => chart?.resize();

const defaultSeries: VitalSignDictItem[] = [
  { id: 'd-hr', code: 'V-HR', name: 'HR', shortCode: 'HR', unit: 'bpm', sortOrder: 1, enabled: true },
  { id: 'd-sbp', code: 'V-SBP', name: 'SBP', shortCode: 'SBP', unit: 'mmHg', sortOrder: 2, enabled: true },
  { id: 'd-dbp', code: 'V-DBP', name: 'DBP', shortCode: 'DBP', unit: 'mmHg', sortOrder: 3, enabled: true },
  { id: 'd-spo2', code: 'V-SPO2', name: 'SpO2', shortCode: 'SpO2', unit: '%', sortOrder: 4, enabled: true },
  { id: 'd-etco2', code: 'V-ETCO2', name: 'EtCO2', shortCode: 'EtCO2', unit: 'mmHg', sortOrder: 5, enabled: true },
  { id: 'd-temp', code: 'V-TEMP', name: 'TEMP', shortCode: 'TEMP', unit: '℃', sortOrder: 6, enabled: true },
];

const activeSeries = () => (props.enabledSeries.length ? props.enabledSeries : defaultSeries);

const render = () => {
  if (!chartRef.value) return;
  chart ??= echarts.init(chartRef.value);
  const times = props.vitals.map((item) => dayjs(item.time).format('HH:mm'));
  const seriesItems = activeSeries();
  const legend = seriesItems.map((item) => item.shortCode);
  const build = (key: keyof VitalSign) => props.vitals.map((item) => (typeof item[key] === 'number' ? item[key] : null));

  chart.setOption({
    color: [
      anesthesiaChartPalette.primary,
      anesthesiaChartPalette.systolic,
      anesthesiaChartPalette.diastolic,
      anesthesiaChartPalette.spo2,
      anesthesiaChartPalette.etco2,
      anesthesiaChartPalette.temperatureSafe,
      anesthesiaChartPalette.reserve,
      anesthesiaChartPalette.reserveAlt,
    ],
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: legend },
    grid: buildGrid({ left: 46, top: 42, bottom: 32 }),
    xAxis: { type: 'category', boundaryGap: false, data: times },
    yAxis: [{ type: 'value', min: 30, max: 180, axisLabel: axisStyle.axisLabel, splitLine: axisStyle.splitLine }],
    series: seriesItems.map((item) => {
      const key = item.shortCode as keyof VitalSign;
      if (item.shortCode === 'TEMP') {
        return {
          name: item.shortCode,
          type: 'line',
          smooth: true,
          data: props.vitals.map((vital) => ({
            value: typeof vital.TEMP === 'number' ? vital.TEMP : null,
            itemStyle: {
              color:
                typeof vital.TEMP === 'number' && vital.TEMP < 36
                  ? anesthesiaChartPalette.temperatureRisk
                  : anesthesiaChartPalette.temperatureSafe,
            },
          })),
        };
      }
      return { name: item.shortCode, type: 'line', smooth: true, data: build(key) };
    }),
  });
};

onMounted(() => {
  render();
  window.addEventListener('resize', onResize);
});
watch(() => [props.vitals, props.enabledSeries], render, { deep: true });
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  chart?.dispose();
});
</script>

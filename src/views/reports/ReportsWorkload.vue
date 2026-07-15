<template>
  <ModulePageShell title="工作量统计" description="基于完整 OperationCase 范围的真实工作量统计">
    <template #toolbar><a-space><a-range-picker v-model="range" value-format="YYYY-MM-DD"/><a-button :loading="loading" @click="reload">刷新</a-button><a-button type="primary" :disabled="!report" @click="exportCsv"><template #icon><icon-download/></template>导出 CSV</a-button></a-space></template>
    <template #stats><MetricCard label="手术总数" :value="report?.scope.total ?? 0" icon="IconCalendar"/><MetricCard label="已完成" :value="report?.scope.completed ?? 0" icon="IconCheckCircle"/><MetricCard label="完成率" :value="`${report?.scope.completionRate ?? 0}%`" icon="IconExperiment"/><MetricCard label="统计日期" :value="report?.workload.length ?? 0" icon="IconFile"/></template>
    <a-alert v-if="error" type="error" show-icon>{{ error }}</a-alert>
    <a-empty v-else-if="!loading && !report?.scope.total" description="当前统计范围无真实病例"/>
    <div v-else class="chart-grid"><a-card class="section-card" :bordered="false" title="每日工作量"><SimpleChart type="line" :labels="report?.workload.map(x=>x.date ?? '') ?? []" :values="report?.workload.map(x=>x.count) ?? []" series-name="手术量"/></a-card><a-card class="section-card" :bordered="false" title="麻醉方式"><SimpleChart type="pie" :labels="report?.methods.map(x=>x.name ?? '') ?? []" :values="report?.methods.map(x=>x.count) ?? []"/></a-card></div>
  </ModulePageShell>
</template>
<script setup lang="ts">
import dayjs from 'dayjs';import { onMounted, ref } from 'vue';import { IconDownload } from '@arco-design/web-vue/es/icon';import MetricCard from '@/components/MetricCard.vue';import ModulePageShell from '@/components/shared/ModulePageShell.vue';import SimpleChart from '@/components/shared/SimpleChart.vue';import { downloadTextFile } from '@/services/clinicalSync';import { loadOperationalReport, operationalReportCsv } from '@/services/quality/qualityOperationalReportService';import type { OperationalReportApi } from '@/api/quality';
const range=ref([dayjs().startOf('month').format('YYYY-MM-DD'),dayjs().format('YYYY-MM-DD')]);const report=ref<OperationalReportApi|null>(null);const loading=ref(false);const error=ref('');
async function reload(){loading.value=true;error.value='';try{report.value=await loadOperationalReport({startDate:range.value[0],endDate:range.value[1]});}catch(e){report.value=null;error.value=`加载失败：${(e as Error).message}`;}finally{loading.value=false;}}
function exportCsv(){if(report.value)downloadTextFile(`workload-${range.value[0]}-${range.value[1]}.csv`,operationalReportCsv(report.value));}
onMounted(reload);
</script>
<style scoped>.chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}@media(max-width:960px){.chart-grid{grid-template-columns:1fr}}</style>

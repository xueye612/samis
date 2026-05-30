<template>
  <ModulePageShell title="麻醉方式分析" description="按麻醉方式统计手术量与占比">
    <template #toolbar>
      <a-button @click="store.refreshClinicalModules()">刷新统计</a-button>
    </template>
    <template #stats>
      <MetricCard label="麻醉总数" :value="stats.totalAnesthesia" icon="IconExperiment" />
      <MetricCard label="全麻" :value="methodValue('全麻')" icon="IconFile" />
      <MetricCard label="椎管内" :value="methodValue('椎管内')" icon="IconHeart" />
      <MetricCard label="神经阻滞" :value="methodValue('阻滞')" icon="IconSwap" />
    </template>
    <div class="chart-grid">
      <a-card class="section-card" :bordered="false" title="麻醉方式分布">
        <SimpleChart type="pie" :labels="stats.methodLabels" :values="stats.methodValues" />
      </a-card>
      <a-card class="section-card" :bordered="false" title="麻醉方式台数">
        <SimpleChart type="bar" :labels="stats.methodLabels" :values="stats.methodValues" series-name="台数" />
      </a-card>
    </div>
    <a-card class="section-card" :bordered="false" title="明细数据">
      <a-table :data="methodRows" :pagination="false" row-key="name">
        <template #columns>
          <a-table-column title="麻醉方式" data-index="name" />
          <a-table-column title="台数" data-index="count" />
          <a-table-column title="占比">
            <template #cell="{ record }">{{ record.ratio }}%</template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MetricCard from '@/components/MetricCard.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import SimpleChart from '@/components/shared/SimpleChart.vue';
import { buildWorkloadStats } from '@/mock/clinicalModulesSeed';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const stats = computed(() => store.workloadStats ?? buildWorkloadStats(store.cases));

const methodValue = (keyword: string) => {
  const idx = stats.value.methodLabels.findIndex((label) => label.includes(keyword));
  return idx >= 0 ? stats.value.methodValues[idx] : 0;
};

const methodRows = computed(() => {
  const total = stats.value.methodValues.reduce((sum, n) => sum + n, 0) || 1;
  return stats.value.methodLabels.map((name, i) => ({
    name,
    count: stats.value.methodValues[i] ?? 0,
    ratio: Math.round(((stats.value.methodValues[i] ?? 0) / total) * 100),
  }));
});
</script>

<style scoped>
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
@media (max-width: 960px) {
  .chart-grid { grid-template-columns: 1fr; }
}
</style>

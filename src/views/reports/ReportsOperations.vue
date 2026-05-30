<template>
  <ModulePageShell title="运营分析" description="按科室、手术间与手术类型汇总运营指标">
    <template #stats>
      <MetricCard label="手术总数" :value="stats.totalSurgeries" icon="IconCalendar" />
      <MetricCard label="完成率" :value="`${stats.completionRate}%`" icon="IconCheckCircle" />
      <MetricCard label="急诊占比" :value="`${emergencyRatio}%`" icon="IconExclamationCircle" />
      <MetricCard label="室外麻醉" :value="outdoorCount" icon="IconExperiment" />
    </template>
    <a-card class="section-card" :bordered="false" title="手术运营统计">
      <a-table :data="operationRows" row-key="key" :pagination="{ pageSize: 10 }">
        <template #columns>
          <a-table-column title="维度" data-index="dimension" :width="100" />
          <a-table-column title="名称" data-index="name" />
          <a-table-column title="台数" data-index="count" :width="80" />
          <a-table-column title="已完成" data-index="completed" :width="90" />
          <a-table-column title="取消" data-index="cancelled" :width="80" />
          <a-table-column title="急诊" data-index="emergency" :width="80" />
          <a-table-column title="完成率" :width="90">
            <template #cell="{ record }">{{ record.completionRate }}%</template>
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
import { buildWorkloadStats } from '@/mock/clinicalModulesSeed';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { SurgeryCase } from '@/types/anesthesia';

interface OpRow {
  key: string;
  dimension: string;
  name: string;
  count: number;
  completed: number;
  cancelled: number;
  emergency: number;
  completionRate: number;
}

const store = useAnesthesiaStore();
const stats = computed(() => store.workloadStats ?? buildWorkloadStats(store.cases));
const outdoorCount = computed(() => store.cases.filter((c) => c.locationType === '手术室外').length);
const emergencyRatio = computed(() => {
  const total = store.cases.length || 1;
  return Math.round((store.cases.filter((c) => c.urgency === '急诊').length / total) * 100);
});

function aggregate(cases: SurgeryCase[], dimension: string, keyFn: (c: SurgeryCase) => string) {
  const map = new Map<string, SurgeryCase[]>();
  cases.forEach((c) => {
    const k = keyFn(c) || '未分类';
    const list = map.get(k) ?? [];
    list.push(c);
    map.set(k, list);
  });
  return [...map.entries()].map(([name, list]) => {
    const completed = list.filter((c) => ['已离室', 'PACU'].includes(c.status)).length;
    const cancelled = list.filter((c) => c.status === '已取消').length;
    const emergency = list.filter((c) => c.urgency === '急诊').length;
    return {
      key: `${dimension}-${name}`,
      dimension,
      name,
      count: list.length,
      completed,
      cancelled,
      emergency,
      completionRate: list.length ? Math.round((completed / list.length) * 100) : 0,
    } satisfies OpRow;
  });
}

const operationRows = computed(() => [
  ...aggregate(store.cases, '科室', (c) => c.department),
  ...aggregate(store.cases, '手术间', (c) => c.room),
  ...aggregate(store.cases, '类型', (c) => c.urgency),
]);
</script>

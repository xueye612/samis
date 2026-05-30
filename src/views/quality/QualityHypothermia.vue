<template>
  <ModulePageShell title="低体温专项" description="筛选术中及恢复期发生低体温的病例，追踪防控与复温措施">
    <template #chips>
      <a-tag color="red">低体温病例 {{ hypothermiaCases.length }}</a-tag>
    </template>
    <template #stats>
      <MetricCard label="低体温事件" :value="hypothermiaEvents.length" icon="IconExclamationCircle" variant="danger" />
      <MetricCard label="涉及病例" :value="hypothermiaCases.length" icon="IconUser" />
      <MetricCard label="已上报" :value="reportedCount" icon="IconCheckCircle" />
    </template>
    <a-card class="section-card" :bordered="false" title="低体温病例">
      <a-table :data="hypothermiaCases" :pagination="{ pageSize: 8 }" row-key="id">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="手术" data-index="surgeryName" />
          <a-table-column title="手术间" data-index="room" :width="100" />
          <a-table-column title="麻醉方式" data-index="anesthesiaMethod" />
          <a-table-column title="低体温事件">
            <template #cell="{ record }">
              <a-space direction="vertical" size="mini">
                <span v-for="event in lowTempEvents(record.id)" :key="event.id">
                  {{ event.time }} · {{ event.stage }} · {{ event.severity }}
                </span>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column title="处置措施">
            <template #cell="{ record }">
              {{ lowTempEvents(record.id).map((e) => e.treatment).join('；') || '—' }}
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="120">
            <template #cell="{ record }">
              <a-button size="mini" type="primary" @click="router.push(`/surgery/detail/${record.id}`)">查看详情</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import MetricCard from '@/components/MetricCard.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { AnesthesiaEvent } from '@/types/anesthesia';

const store = useAnesthesiaStore();
const router = useRouter();

const isLowTempEvent = (event: AnesthesiaEvent) => event.type === '低体温';

const hypothermiaCases = computed(() => store.cases.filter((item) => item.events.some(isLowTempEvent)));

const lowTempEvents = (caseId: string) => {
  const target = store.cases.find((item) => item.id === caseId);
  return target?.events.filter(isLowTempEvent) ?? [];
};

const hypothermiaEvents = computed(() =>
  hypothermiaCases.value.flatMap((item) => item.events.filter(isLowTempEvent)),
);

const reportedCount = computed(() => hypothermiaEvents.value.filter((item) => item.reported).length);
</script>

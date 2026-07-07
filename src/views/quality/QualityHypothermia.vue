<template>
  <ModulePageShell title="低体温专项" description="筛选术中及恢复期发生低体温的病例，追踪防控与复温措施">
    <template #chips>
      <a-tag color="red">低体温病例 {{ cases.length }}</a-tag>
      <a-tag v-if="useReal">来源 {{ aggregatorSource }}</a-tag>
    </template>
    <template #stats>
      <MetricCard label="低体温事件" :value="eventCount" icon="IconExclamationCircle" variant="danger" />
      <MetricCard label="涉及病例" :value="cases.length" icon="IconUser" />
      <MetricCard v-if="useReal" label="数据来源" :value="aggregatorSource === 'remote' ? '服务端' : '本地'" icon="IconStorage" />
    </template>
    <a-card class="section-card" :bordered="false" title="低体温病例">
      <a-table :data="cases" :pagination="{ pageSize: 8 }" row-key="rowKey">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="手术" data-index="surgeryName" />
          <a-table-column title="手术间" data-index="room" :width="100" />
          <a-table-column title="麻醉方式" data-index="anesthesiaMethod" />
          <a-table-column title="低体温事件">
            <template #cell="{ record }">
              <a-space direction="vertical" size="mini">
                <span v-for="(line, idx) in evidenceLines(record)" :key="idx">{{ line }}</span>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column title="处置措施">
            <template #cell="{ record }">{{ treatmentOf(record) }}</template>
          </a-table-column>
          <a-table-column title="操作" :width="120">
            <template #cell="{ record }">
              <a-button size="mini" type="primary" @click="router.push(`/surgery/detail/${record.caseId}`)">查看详情</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import MetricCard from '@/components/MetricCard.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { useRealQuality } from '@/config/apiFlags';
import type { AnesthesiaEvent } from '@/types/anesthesia';
import type { QualityHypothermiaCaseApi } from '@/api/quality';

const store = useAnesthesiaStore();
const router = useRouter();
const useReal = useRealQuality();

const isLowTempEvent = (event: AnesthesiaEvent) => event.type === '低体温';

const mockCases = computed(() => store.cases.filter((item) => item.events.some(isLowTempEvent)));

interface HypothermiaRow {
  rowKey: string;
  caseId: string;
  patientName: string;
  surgeryName: string;
  room: string;
  anesthesiaMethod: string;
  evidence: QualityHypothermiaCaseApi['evidence'];
  treatments: string[];
}

const cases = computed<HypothermiaRow[]>(() => {
  if (!useReal) {
    return mockCases.value.map((c) => {
      const events = c.events.filter(isLowTempEvent);
      return {
        rowKey: c.id,
        caseId: c.id,
        patientName: c.patientName,
        surgeryName: c.surgeryName,
        room: c.room,
        anesthesiaMethod: c.anesthesiaMethod,
        evidence: [],
        treatments: events.map((e) => e.treatment).filter(Boolean),
      };
    });
  }
  return store.remoteHypothermiaCases.list.map((c) => ({
    rowKey: c.caseId,
    caseId: c.caseId,
    patientName: c.patientName,
    surgeryName: c.operationName,
    room: c.room,
    anesthesiaMethod: c.anesthesiaMethod,
    evidence: c.evidence,
    treatments: [],
  }));
});

const eventCount = computed(() => {
  if (!useReal) {
    return mockCases.value.flatMap((item) => item.events.filter(isLowTempEvent)).length;
  }
  return store.remoteHypothermiaCases.total;
});

const aggregatorSource = computed(() => store.aggregatorSource);

const evidenceLines = (row: HypothermiaRow): string[] => {
  if (!useReal) {
    const target = store.cases.find((item) => item.id === row.caseId);
    return (target?.events.filter(isLowTempEvent) ?? []).map((e) => `${e.time} · ${e.stage} · ${e.severity}`);
  }
  return row.evidence.map((ev) => {
    if (ev.source === 'event') return `事件 · ${ev.type ?? '低体温'}`;
    if (ev.source === 'vital_temp') return `术中体温 · 最低 ${ev.min ?? '?'}℃`;
    if (ev.source === 'pacu_first_temp') return `PACU 入室体温 · ${ev.value ?? '?'}℃`;
    return '低体温';
  });
};

const treatmentOf = (row: HypothermiaRow): string => {
  if (!useReal) {
    const target = store.cases.find((item) => item.id === row.caseId);
    return (target?.events.filter(isLowTempEvent) ?? []).map((e) => e.treatment).join('；') || '—';
  }
  return row.treatments.join('；') || '—';
};

onMounted(() => {
  if (useReal) {
    store.loadRemoteHypothermiaCases();
  }
});
</script>

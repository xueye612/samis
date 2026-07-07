<template>
  <ModulePageShell title="不良事件统计" description="麻醉相关质控不良事件汇总与审核状态">
    <template #chips>
      <a-tag color="red">质控事件 {{ qualityEvents.length }}</a-tag>
      <a-tag color="orangered">待审核 {{ pendingReviewCount }}</a-tag>
      <a-tag v-if="useReal">来源 {{ aggregatorSource }}</a-tag>
    </template>
    <template #toolbar>
      <a-select v-if="!useReal" v-model="stageFilter" style="width: 140px" allow-clear placeholder="事件阶段">
        <a-option v-for="stage in stages" :key="stage" :value="stage">{{ stage }}</a-option>
      </a-select>
      <a-button v-if="useReal" :loading="loading" @click="reload">刷新</a-button>
    </template>
    <a-card class="section-card" :bordered="false" title="不良事件列表">
      <a-table :data="filteredEvents" :pagination="{ pageSize: 8 }" row-key="rowKey">
        <template #columns>
          <a-table-column title="事件类型" data-index="eventType" />
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="阶段" data-index="eventStage" :width="90" />
          <a-table-column title="严重程度" :width="100">
            <template #cell="{ record }">
              <a-tag :color="severityColor(record.severity)">{{ record.severity || '—' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="描述" data-index="description" />
          <a-table-column title="处置" data-index="treatment" />
          <a-table-column title="审核" :width="100">
            <template #cell="{ record }">
              <a-tag :color="reviewColor(record.reviewStatus)">{{ record.reviewStatus || '—' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="100">
            <template #cell="{ record }">
              <a-button size="mini" type="text" @click="router.push(`/surgery/detail/${record.caseId}`)">病例</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import { useRealQuality } from '@/config/apiFlags';
import type { AnesthesiaEventTable } from '@/types/mockTables';

interface AdverseRow {
  rowKey: string;
  caseId: string;
  patientName: string;
  eventType: string;
  eventStage: string;
  severity: string;
  description: string;
  treatment: string;
  reviewStatus: string;
}

const store = useAnesthesiaStore();
const router = useRouter();
const useReal = useRealQuality();
const stageFilter = ref<string | undefined>();
const loading = ref(false);

const mockQualityEvents = computed(() => store.qualityDataset.events.filter((item) => item.isQualityEvent));

const qualityEvents = computed<AdverseRow[]>(() => {
  if (!useReal) {
    return mockQualityEvents.value.map((e) => ({
      rowKey: e.eventId,
      caseId: e.caseId,
      patientName: store.cases.find((item) => item.id === e.caseId)?.patientName ?? e.caseId,
      eventType: e.eventType,
      eventStage: e.eventStage,
      severity: e.severity,
      description: e.description,
      treatment: e.treatment,
      reviewStatus: e.reviewStatus,
    }));
  }
  return store.remoteAdverseEvents.list.map((e) => ({
    rowKey: String(e.id),
    caseId: e.caseId,
    patientName: e.patientName,
    eventType: e.type,
    eventStage: e.stage ?? '',
    severity: e.severity ?? '',
    description: e.description ?? '',
    treatment: e.treatment ?? '',
    reviewStatus: e.reviewStatus ?? '',
  }));
});

const stages = computed(() => [...new Set(qualityEvents.value.map((item) => item.eventStage))]);
const pendingReviewCount = computed(() => qualityEvents.value.filter((item) => item.reviewStatus === '待审核').length);
const aggregatorSource = computed(() => store.aggregatorSource);

const filteredEvents = computed(() => {
  if (useReal || !stageFilter.value) return qualityEvents.value;
  return qualityEvents.value.filter((item) => item.eventStage === stageFilter.value);
});

const severityColor = (severity: AnesthesiaEventTable['severity'] | string) => ({
  轻度: 'arcoblue',
  中度: 'orangered',
  重度: 'red',
  危急: 'red',
}[severity as string] ?? 'gray');

const reviewColor = (status: AnesthesiaEventTable['reviewStatus'] | string) => ({
  待审核: 'orangered',
  已确认: 'green',
  排除: 'gray',
}[status as string] ?? 'gray');

const reload = async () => {
  loading.value = true;
  try {
    await store.loadRemoteAdverseEvents();
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (useReal) {
    reload();
  }
});
</script>

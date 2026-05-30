<template>
  <ModulePageShell title="不良事件统计" description="麻醉相关质控不良事件汇总与审核状态">
    <template #chips>
      <a-tag color="red">质控事件 {{ qualityEvents.length }}</a-tag>
      <a-tag color="orangered">待审核 {{ pendingReviewCount }}</a-tag>
    </template>
    <template #toolbar>
      <a-select v-model="stageFilter" style="width: 140px" allow-clear placeholder="事件阶段">
        <a-option v-for="stage in stages" :key="stage" :value="stage">{{ stage }}</a-option>
      </a-select>
    </template>
    <a-card class="section-card" :bordered="false" title="不良事件列表">
      <a-table :data="filteredEvents" :pagination="{ pageSize: 8 }" row-key="eventId">
        <template #columns>
          <a-table-column title="事件类型" data-index="eventType" />
          <a-table-column title="患者">
            <template #cell="{ record }">{{ caseName(record.caseId) }}</template>
          </a-table-column>
          <a-table-column title="阶段" data-index="eventStage" :width="80" />
          <a-table-column title="严重程度" :width="100">
            <template #cell="{ record }">
              <a-tag :color="severityColor(record.severity)">{{ record.severity }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="描述" data-index="description" />
          <a-table-column title="处置" data-index="treatment" />
          <a-table-column title="上报" :width="80">
            <template #cell="{ record }">
              <a-tag :color="record.reported ? 'green' : 'gray'">{{ record.reported ? '已上报' : '未上报' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="审核" :width="100">
            <template #cell="{ record }">
              <a-tag :color="reviewColor(record.reviewStatus)">{{ record.reviewStatus }}</a-tag>
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
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { AnesthesiaEventTable } from '@/types/mockTables';

const store = useAnesthesiaStore();
const router = useRouter();
const stageFilter = ref<string | undefined>();

const qualityEvents = computed(() => store.qualityDataset.events.filter((item) => item.isQualityEvent));

const stages = computed(() => [...new Set(qualityEvents.value.map((item) => item.eventStage))]);

const pendingReviewCount = computed(() => qualityEvents.value.filter((item) => item.reviewStatus === '待审核').length);

const caseName = (caseId: string) => store.cases.find((item) => item.id === caseId)?.patientName ?? caseId;

const severityColor = (severity: AnesthesiaEventTable['severity']) => ({
  轻度: 'arcoblue',
  中度: 'orangered',
  重度: 'red',
  危急: 'red',
}[severity] ?? 'gray');

const reviewColor = (status: AnesthesiaEventTable['reviewStatus']) => ({
  待审核: 'orangered',
  已确认: 'green',
  排除: 'gray',
}[status] ?? 'gray');

const filteredEvents = computed(() => {
  if (!stageFilter.value) return qualityEvents.value;
  return qualityEvents.value.filter((item) => item.eventStage === stageFilter.value);
});
</script>

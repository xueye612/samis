<template>
  <ModulePageShell title="非计划事件追踪" description="非计划转 ICU、非计划二次插管等事件监控">
    <template #chips>
      <a-tag color="orangered">事件 {{ eventCases.length }}</a-tag>
    </template>
    <a-card class="section-card" :bordered="false" title="非计划事件病例">
      <a-table :data="eventCases" row-key="id" :pagination="{ pageSize: 8 }">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" :width="100" />
          <a-table-column title="手术" data-index="surgeryName" />
          <a-table-column title="事件类型">
            <template #cell="{ record }">{{ eventLabel(record) }}</template>
          </a-table-column>
          <a-table-column title="计划转 ICU" :width="110">
            <template #cell="{ record }">
              <a-tag v-if="record.transferIcuPlanned" color="arcoblue">计划内</a-tag>
              <span v-else class="muted">否</span>
            </template>
          </a-table-column>
          <a-table-column title="转出去向" :width="100">
            <template #cell="{ record }">{{ record.transferTo ?? '—' }}</template>
          </a-table-column>
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }"><StatusTag :value="('status' in record && record.status) || '已完成'" /></template>
          </a-table-column>
          <a-table-column title="操作" :width="120" fixed="right">
            <template #cell="{ record }">
              <a-button size="mini" type="primary" @click="goDetail(caseIdOf(record))">详情</a-button>
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
import StatusTag from '@/components/StatusTag.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { PostCaseSummary } from '@/services/anesthesia/postoperativeService';

const store = useAnesthesiaStore();
const router = useRouter();

const eventCases = computed<PostCaseSummary[]>(() => store.unplannedCases);

const caseIdOf = (row: PostCaseSummary) => row.operationId;

const eventLabel = (item: PostCaseSummary) => {
  if (item.transferIcuPlanned) return '计划转 ICU';
  if (item.transferTo === 'ICU') return '转出 ICU';
  return '—';
};

const goDetail = (id: string) => router.push({ path: '/postoperative/unplanned-event-detail', query: { operationId: id } });

onMounted(() => void store.loadRemoteUnplannedCases());
</script>

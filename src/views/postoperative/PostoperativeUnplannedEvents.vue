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
            <template #cell="{ record }"><StatusTag :value="record.status" /></template>
          </a-table-column>
          <a-table-column title="操作" :width="120" fixed="right">
            <template #cell="{ record }">
              <a-button size="mini" type="primary" @click="goDetail(record.id)">详情</a-button>
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
import StatusTag from '@/components/StatusTag.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { SurgeryCase } from '@/types/anesthesia';

const UNPLANNED_TYPES = ['非计划转ICU', '非计划二次插管', '心脏骤停', '严重过敏'];

const store = useAnesthesiaStore();
const router = useRouter();

const hasUnplannedEvent = (item: SurgeryCase) =>
  item.events.some((e) => UNPLANNED_TYPES.includes(e.type) || (e.type.includes('非计划') && e.qualityIncluded));

const eventCases = computed(() =>
  store.cases.filter((item) => item.transferIcuPlanned || hasUnplannedEvent(item) || item.transferTo === 'ICU'),
);

const eventLabel = (item: SurgeryCase) => {
  const evt = item.events.find((e) => UNPLANNED_TYPES.includes(e.type) || e.type.includes('非计划'));
  if (evt) return evt.type;
  if (item.transferIcuPlanned) return '计划转 ICU';
  if (item.transferTo === 'ICU') return '转出 ICU';
  return '—';
};

const goDetail = (id: string) => router.push(`/surgery/detail/${id}`);
</script>

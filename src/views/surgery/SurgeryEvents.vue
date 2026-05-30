<template>
  <ModulePageShell title="特殊事件/抢救记录" description="术中特殊事件与抢救过程记录">
    <a-card class="section-card" :bordered="false">
      <a-table :data="eventRows" row-key="id" :pagination="{ pageSize: 10 }">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="事件类型" data-index="type" />
          <a-table-column title="阶段" data-index="stage" />
          <a-table-column title="严重程度" data-index="severity" />
          <a-table-column title="时间" data-index="time" />
          <a-table-column title="处理措施" data-index="treatment" />
          <a-table-column title="操作" :width="120">
            <template #cell="{ record }">
              <a-button size="mini" type="primary" @click="router.push(`/surgery/detail/${record.caseId}`)">详情</a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const router = useRouter();
const store = useAnesthesiaStore();
const eventRows = computed(() => store.cases.flatMap((item) => item.events.map((event) => ({
  id: event.id,
  caseId: item.id,
  patientName: item.patientName,
  type: event.type,
  stage: event.stage,
  severity: event.severity,
  treatment: event.treatment || '待补记',
  time: dayjs(event.time).format('MM-DD HH:mm'),
}))));
</script>

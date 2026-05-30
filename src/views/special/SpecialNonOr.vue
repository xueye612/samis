<template>
  <ModulePageShell title="非手术室麻醉" description="内镜、介入等手术室外麻醉病例">
    <template #chips>
      <a-tag color="purple">室外 {{ cases.length }}</a-tag>
    </template>
    <a-card class="section-card" :bordered="false" title="手术室外麻醉病例">
      <a-table :data="cases" row-key="id" :pagination="{ pageSize: 8 }">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" :width="100" />
          <a-table-column title="操作" data-index="surgeryName" />
          <a-table-column title="科室" data-index="department" />
          <a-table-column title="地点" data-index="room" :width="90" />
          <a-table-column title="麻醉方式" data-index="anesthesiaMethod" />
          <a-table-column title="类型" :width="90">
            <template #cell="{ record }">
              <a-tag :color="record.urgency === '急诊' ? 'red' : 'green'">{{ record.urgency }}</a-tag>
            </template>
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

const store = useAnesthesiaStore();
const router = useRouter();
const cases = computed(() => store.cases.filter((item) => item.locationType === '手术室外'));
const goDetail = (id: string) => router.push(`/surgery/detail/${id}`);
</script>

<template>
  <ModulePageShell title="产科/分娩镇痛" description="阴道分娩椎管内镇痛与相关麻醉病例">
    <template #chips>
      <a-tag color="arcoblue">阴道分娩 {{ cases.length }}</a-tag>
    </template>
    <a-card class="section-card" :bordered="false" title="分娩镇痛病例">
      <a-table v-if="cases.length" :data="cases" row-key="id" :pagination="{ pageSize: 8 }">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" :width="100" />
          <a-table-column title="手术/操作" data-index="surgeryName" />
          <a-table-column title="科室" data-index="department" />
          <a-table-column title="麻醉方式" data-index="anesthesiaMethod" />
          <a-table-column title="ASA" data-index="asa" :width="70" />
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
      <EmptyState v-else title="暂无阴道分娩病例" description="Mock 中 isVaginalDelivery 标记的病例将显示在此" icon="IconHeart" />
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import StatusTag from '@/components/StatusTag.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';

const store = useAnesthesiaStore();
const router = useRouter();
const cases = computed(() => store.cases.filter((item) => item.isVaginalDelivery === true));
const goDetail = (id: string) => router.push(`/surgery/detail/${id}`);
</script>

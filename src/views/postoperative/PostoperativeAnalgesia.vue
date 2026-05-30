<template>
  <ModulePageShell title="术后镇痛" description="已启用术后镇痛方案的病例管理与随访入口">
    <template #chips>
      <a-tag color="arcoblue">镇痛病例 {{ analgesiaCases.length }}</a-tag>
      <a-tag v-if="pendingFollowUp.length" color="orangered">待随访 {{ pendingFollowUp.length }}</a-tag>
    </template>
    <a-card class="section-card" :bordered="false" title="术后镇痛病例">
      <a-table :data="analgesiaCases" row-key="id" :pagination="{ pageSize: 8 }">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" :width="100" />
          <a-table-column title="手术" data-index="surgeryName" />
          <a-table-column title="麻醉方式" data-index="anesthesiaMethod" />
          <a-table-column title="手术间" data-index="room" :width="90" />
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }"><StatusTag :value="record.status" /></template>
          </a-table-column>
          <a-table-column title="随访" :width="100">
            <template #cell="{ record }">
              <a-tag :color="hasFollowUp(record.id) ? 'green' : 'orange'">{{ hasFollowUp(record.id) ? '已随访' : '待随访' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="200" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-button size="mini" type="primary" @click="goDetail(record.id)">详情</a-button>
                <a-button size="mini" @click="goFollowUp(record.id)">随访</a-button>
              </a-space>
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

const analgesiaCases = computed(() => store.cases.filter((item) => item.postoperativeAnalgesia));
const followedIds = computed(() => new Set(store.followUps.map((item) => item.caseId)));
const pendingFollowUp = computed(() => analgesiaCases.value.filter((item) => !followedIds.value.has(item.id)));

const hasFollowUp = (caseId: string) => followedIds.value.has(caseId);
const goDetail = (id: string) => router.push(`/surgery/detail/${id}`);
const goFollowUp = (id: string) => router.push({ path: '/postoperative/followup', query: { caseId: id } });
</script>

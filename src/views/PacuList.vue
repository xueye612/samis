<template>
  <ModulePageShell title="PACU恢复室总览" description="真实床位资源、恢复记录与状态时间">
    <template #chips>
      <a-tag color="arcoblue">在室 {{ activeRecords.length }}</a-tag>
      <a-tag>床位 {{ beds.length }}</a-tag>
    </template>
    <template #toolbar>
      <a-button :loading="loading" @click="load">刷新</a-button>
      <a-button @click="router.push('/pacu/booking')">预约</a-button>
      <a-button @click="router.push('/pacu/receive')">接收</a-button>
      <a-button @click="router.push('/pacu/transfer')">转出</a-button>
    </template>
    <a-alert v-if="error" type="error" :title="error" style="margin-bottom: 16px" />
    <a-card class="section-card" :bordered="false" title="床位资源">
      <a-empty v-if="!loading && beds.length === 0" description="远程暂无床位数据" />
      <a-table v-else :data="beds" row-key="bedId" :pagination="false">
        <template #columns>
          <a-table-column title="床位ID" data-index="bedId" />
          <a-table-column title="复苏室" data-index="roomId" />
          <a-table-column title="床号" data-index="bedNo" />
          <a-table-column title="状态"><template #cell="{ record }"><StatusTag :value="record.status" /></template></a-table-column>
          <a-table-column title="版本"><template #cell="{ record }">v{{ record.version }}</template></a-table-column>
        </template>
      </a-table>
    </a-card>
    <a-card class="section-card" :bordered="false" title="恢复记录" style="margin-top: 16px">
      <a-empty v-if="!loading && records.length === 0" description="远程暂无PACU恢复记录" />
      <a-table v-else :data="records" row-key="pacuRecordId" :pagination="{ pageSize: 10 }">
        <template #columns>
          <a-table-column title="手术ID" data-index="operationId" />
          <a-table-column title="床位" data-index="bedName" />
          <a-table-column title="入室时间" data-index="admittedAt" />
          <a-table-column title="达标时间" data-index="dischargeReadyAt" />
          <a-table-column title="出室时间" data-index="dischargedAt" />
          <a-table-column title="状态"><template #cell="{ record }"><StatusTag :value="record.status" /></template></a-table-column>
          <a-table-column title="版本"><template #cell="{ record }">v{{ record.version }}</template></a-table-column>
          <a-table-column title="操作"><template #cell="{ record }"><a-button size="mini" type="primary" @click="router.push({ path: '/pacu/record', query: { operationId: record.operationId } })">恢复记录</a-button></template></a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import StatusTag from '@/components/StatusTag.vue';
import { pacuApi } from '@/api/pacu';
import type { PacuRecordContract } from '@/services/anesthesia/pacuWorkflow';

interface PacuBedRow { bedId: string; roomId: string; bedNo: string; status: string; version: number }
const router = useRouter();
const records = ref<PacuRecordContract[]>([]);
const beds = ref<PacuBedRow[]>([]);
const loading = ref(false);
const error = ref('');
const activeRecords = computed(() => records.value.filter((item) => !['discharged', 'voided'].includes(item.status)));
function rows<T>(raw: unknown): T[] {
  const result = raw as { list?: T[] };
  return Array.isArray(result?.list) ? result.list : [];
}
async function load() {
  loading.value = true;
  try {
    const [recordResult, bedResult] = await Promise.all([pacuApi.getList({ pageSize: 200 }), pacuApi.bedList({ pageSize: 200 })]);
    records.value = rows<PacuRecordContract>(recordResult);
    beds.value = rows<PacuBedRow>(bedResult);
    error.value = '';
  } catch (cause) {
    records.value = [];
    beds.value = [];
    error.value = cause instanceof Error ? cause.message : 'PACU真实数据加载失败';
  } finally {
    loading.value = false;
  }
}
onMounted(() => void load());
</script>

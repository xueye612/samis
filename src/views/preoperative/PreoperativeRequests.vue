<template>
  <ModulePageShell title="手术通知查看" description="数据来自 HULI 手术通知单，麻醉系统只读展示，不接收、取消或改写手术通知">
    <template #chips>
      <a-tag color="green">权威来源：HULI</a-tag>
      <a-tag color="arcoblue">共 {{ rows.length }} 例</a-tag>
      <a-tag color="gray">只读</a-tag>
    </template>
    <template #toolbar>
      <a-input-search v-model="keyword" placeholder="搜索患者/住院号/手术/科室" allow-clear style="width: 300px" />
      <a-button :loading="loading" style="margin-left: 8px" @click="reload">刷新</a-button>
    </template>

    <a-alert v-if="error" type="error" show-icon style="margin-bottom: 12px">
      {{ error }} <a-button size="mini" type="text" @click="reload">重试</a-button>
    </a-alert>
    <a-alert type="info" show-icon style="margin-bottom: 12px">
      如需变更手术通知、取消手术或调整排班，请在手术护理系统处理；本页刷新后读取最新结果。
    </a-alert>
    <a-card class="section-card" :bordered="false" title="手术通知列表">
      <a-table v-if="filtered.length || loading" :data="filtered" :loading="loading" :pagination="{ pageSize: 8 }" row-key="operationId">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="住院号"><template #cell="{ record }">{{ record.operationCase?.patientNo || '—' }}</template></a-table-column>
          <a-table-column title="科室"><template #cell="{ record }">{{ record.department || '—' }}</template></a-table-column>
          <a-table-column title="术前诊断"><template #cell="{ record }">{{ record.operationCase?.preoperativeDiagnosisName || '—' }}</template></a-table-column>
          <a-table-column title="拟行手术"><template #cell="{ record }">{{ record.surgeryName || '—' }}</template></a-table-column>
          <a-table-column title="主刀医师" :width="120"><template #cell="{ record }">{{ record.surgeon || record.operationCase?.surgeonName || '—' }}</template></a-table-column>
          <a-table-column title="手术间" :width="110"><template #cell="{ record }">{{ record.operationCase?.roomName || record.operationCase?.roomCode || '待分配' }}</template></a-table-column>
          <a-table-column title="计划时间" :width="170"><template #cell="{ record }">{{ plannedTime(record) }}</template></a-table-column>
          <a-table-column title="通知状态" :width="110"><template #cell="{ record }"><a-tag :color="statusColor(record.operationStatus || record.operationCase?.status)">{{ record.operationStatus || record.operationCase?.status || '—' }}</a-tag></template></a-table-column>
          <a-table-column title="来源" :width="100"><template #cell="{ record }"><a-tag color="green">{{ record.sourceSystem || 'HULI' }}</a-tag></template></a-table-column>
        </template>
      </a-table>
      <EmptyState v-else title="暂无手术通知" description="HULI 当前未返回手术通知" icon="IconCalendar" />
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import type { PreopRequest } from '@/api/preoperative';
import { loadRequestList } from '@/services/preoperative/preoperativeFiveFlowsService';

const rows = ref<PreopRequest[]>([]);
const loading = ref(false);
const error = ref('');
const keyword = ref('');

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((item) => [item.patientName, item.department, item.surgeryName, item.operationCase?.patientNo]
    .some((value) => String(value ?? '').toLowerCase().includes(q)));
});
const statusColor = (status: string | null | undefined) => ({ 待入室: 'arcoblue', 已入室: 'green', 已取消: 'red' }[String(status ?? '')] ?? 'gray');
const plannedTime = (record: PreopRequest) => record.operationCase?.plannedStartTime
  || record.operationCase?.operationDate
  || '—';

async function reload() {
  loading.value = true; error.value = '';
  try { rows.value = await loadRequestList({ pageSize: 200 }); }
  catch (e) { error.value = e instanceof Error ? e.message : '加载手术申请失败'; rows.value = []; }
  finally { loading.value = false; }
}
onMounted(reload);
</script>

<style scoped>
:deep(.section-card .arco-card-header) { min-height: 44px; }
:deep(.arco-table-cell) { font-size: var(--font-size-sm); }
</style>

<template>
  <ModulePageShell title="手术申请接收" description="病例来自 HULI 手术通知单，SAMIS 仅保存接收状态">
    <template #chips>
      <a-tag color="arcoblue">待接收 {{ count('待接收') }}</a-tag>
      <a-tag color="green">已排班 {{ count('已排班') }}</a-tag>
      <a-tag color="red">已取消 {{ count('已取消') }}</a-tag>
    </template>
    <template #toolbar>
      <a-input-search v-model="keyword" placeholder="搜索患者/住院号/手术/科室" allow-clear style="width: 300px" />
      <a-button :loading="loading" style="margin-left: 8px" @click="reload">刷新</a-button>
    </template>

    <a-alert v-if="error" type="error" show-icon style="margin-bottom: 12px">
      {{ error }} <a-button size="mini" type="text" @click="reload">重试</a-button>
    </a-alert>
    <a-card class="section-card" :bordered="false" title="手术申请列表">
      <a-table v-if="filtered.length || loading" :data="filtered" :loading="loading" :pagination="{ pageSize: 8 }" row-key="operationId">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="住院号"><template #cell="{ record }">{{ record.operationCase?.patientNo || '—' }}</template></a-table-column>
          <a-table-column title="科室" data-index="department" />
          <a-table-column title="术前诊断"><template #cell="{ record }">{{ record.operationCase?.preoperativeDiagnosisName || '—' }}</template></a-table-column>
          <a-table-column title="拟行手术" data-index="surgeryName" />
          <a-table-column title="计划日期" data-index="requestDate" :width="160" />
          <a-table-column title="状态" :width="100"><template #cell="{ record }"><a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag></template></a-table-column>
          <a-table-column title="操作" :width="150">
            <template #cell="{ record }">
              <a-space v-if="record.status === '待接收' && canManage">
                <a-button size="mini" type="primary" :loading="acting === record.operationId" @click="onReceive(record)">接收</a-button>
                <a-button size="mini" status="danger" @click="openCancel(record)">取消</a-button>
              </a-space>
              <span v-else>{{ record.receivedAt || record.cancelledAt || '—' }}</span>
            </template>
          </a-table-column>
        </template>
      </a-table>
      <EmptyState v-else title="暂无待手术病例" description="HULI 当前没有可进入术前流程的病例" icon="IconCalendar" />
    </a-card>

    <a-modal :visible="cancelVisible" title="取消手术申请" @cancel="cancelVisible = false" @ok="confirmCancel">
      <OperationCaseSummary :case-data="cancelTarget?.operationCase ?? null" />
      <a-form-item label="取消原因" required style="margin-top: 16px"><a-textarea v-model="cancelReason" /></a-form-item>
    </a-modal>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import EmptyState from '@/components/shared/EmptyState.vue';
import OperationCaseSummary from '@/components/preoperative/OperationCaseSummary.vue';
import type { PreopRequest } from '@/api/preoperative';
import { authApi } from '@/api/auth';
import { cancelRequest, hasPreopPermission, loadRequestList, receiveRequest } from '@/services/preoperative/preoperativeFiveFlowsService';

const rows = ref<PreopRequest[]>([]);
const loading = ref(false);
const error = ref('');
const keyword = ref('');
const acting = ref('');
const cancelVisible = ref(false);
const cancelTarget = ref<PreopRequest | null>(null);
const cancelReason = ref('');
const permissions = ref<string[]>([]);
const canManage = computed(() => hasPreopPermission(permissions.value, 'preop.request.manage'));

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return rows.value;
  return rows.value.filter((item) => [item.patientName, item.department, item.surgeryName, item.operationCase?.patientNo]
    .some((value) => String(value ?? '').toLowerCase().includes(q)));
});
const count = (status: string) => rows.value.filter((item) => item.status === status).length;
const statusColor = (status: string) => ({ 待接收: 'arcoblue', 已排班: 'green', 已取消: 'red' }[status] ?? 'gray');

async function reload() {
  loading.value = true; error.value = '';
  try { rows.value = await loadRequestList({ pageSize: 200 }); }
  catch (e) { error.value = e instanceof Error ? e.message : '加载手术申请失败'; rows.value = []; }
  finally { loading.value = false; }
}
async function onReceive(record: PreopRequest) {
  acting.value = record.operationId;
  try { await receiveRequest(record); await reload(); Message.success('接收成功'); }
  catch (e) { Message.error(e instanceof Error ? e.message : '接收失败'); }
  finally { acting.value = ''; }
}
function openCancel(record: PreopRequest) { cancelTarget.value = record; cancelReason.value = ''; cancelVisible.value = true; }
async function confirmCancel() {
  if (!cancelTarget.value || !cancelReason.value.trim()) { Message.warning('请填写取消原因'); return; }
  acting.value = cancelTarget.value.operationId;
  try { await cancelRequest(cancelTarget.value, cancelReason.value.trim()); cancelVisible.value = false; await reload(); Message.success('取消成功'); }
  catch (e) { Message.error(e instanceof Error ? e.message : '取消失败'); }
  finally { acting.value = ''; }
}
async function loadPermissions(){try{const result=await authApi.myPermissions();permissions.value=Array.isArray(result?.permissions)?result.permissions.map(String):[];}catch{permissions.value=[];}}
onMounted(()=>Promise.all([loadPermissions(),reload()]));
</script>

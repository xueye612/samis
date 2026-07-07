<template>
  <ModulePageShell title="手术申请接收" description="接收手术申请、核对基本信息并安排排班">
    <template #chips>
      <a-tag color="arcoblue">待接收 {{ statusCount('待接收') }}</a-tag>
      <a-tag color="green">已排班 {{ statusCount('已排班') }}</a-tag>
      <a-tag color="red">已取消 {{ statusCount('已取消') }}</a-tag>
    </template>
    <template #toolbar>
      <a-input-search v-model="keyword" placeholder="搜索患者/手术/科室" allow-clear style="width: 280px" />
      <a-button status="success" :loading="loading" style="margin-left: 8px" @click="reload">
        <template #icon><IconRefresh /></template>
        刷新
      </a-button>
    </template>
    <a-card class="section-card" :bordered="false" title="手术申请列表">
      <a-table :data="filtered" :pagination="{ pageSize: 8 }" :loading="loading" row-key="id">
        <template #columns>
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="科室" data-index="department" />
          <a-table-column title="手术名称" data-index="surgeryName" />
          <a-table-column title="急诊/择期" data-index="urgency" :width="90" />
          <a-table-column title="申请日期" data-index="requestDate" :width="120" />
          <a-table-column title="主刀" data-index="surgeon" :width="100" />
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="requestStatusColor(record.status)">{{ record.status }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="160">
            <template #cell="{ record }">
              <a-space :size="4">
                <a-button
                  v-if="record.status === '待接收'"
                  type="primary"
                  size="mini"
                  :loading="actingId === record.id"
                  @click="onReceive(record)"
                >接收</a-button>
                <a-button
                  v-if="record.status !== '已取消'"
                  status="danger"
                  size="mini"
                  :loading="actingId === record.id"
                  @click="onCancel(record)"
                >取消</a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconRefresh } from '@arco-design/web-vue/es/icon';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { SurgeryRequest } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const keyword = ref('');
const loading = ref(false);
const actingId = ref('');

const requestStatusColor = (status: SurgeryRequest['status']) => ({
  待接收: 'arcoblue',
  已排班: 'green',
  已取消: 'red',
}[status] ?? 'gray');

const statusCount = (status: SurgeryRequest['status']) => store.surgeryRequests.filter((item) => item.status === status).length;

const filtered = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return store.surgeryRequests;
  return store.surgeryRequests.filter((item) =>
    [item.patientName, item.department, item.surgeryName, item.surgeon].some((field) => field.toLowerCase().includes(q)),
  );
});

async function reload() {
  loading.value = true;
  try {
    await store.loadRemotePreopRequests();
  } finally {
    loading.value = false;
  }
}

async function onReceive(record: SurgeryRequest) {
  actingId.value = record.id;
  try {
    await store.receivePreopRequest(record.id);
    Message.success(`已接收：${record.patientName}`);
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '接收失败');
  } finally {
    actingId.value = '';
  }
}

async function onCancel(record: SurgeryRequest) {
  actingId.value = record.id;
  try {
    await store.cancelPreopRequest(record.id);
    Message.success(`已取消：${record.patientName}`);
  } catch (error) {
    Message.error(error instanceof Error ? error.message : '取消失败');
  } finally {
    actingId.value = '';
  }
}

onMounted(reload);
</script>

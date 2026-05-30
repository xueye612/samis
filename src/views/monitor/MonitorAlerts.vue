<template>
  <ModulePageShell title="实时告警" description="术中生命体征与设备异常实时告警处置">
    <template #chips>
      <a-tag color="red">未处理 {{ unhandledCount }}</a-tag>
      <a-tag color="green">已处理 {{ store.monitorAlerts.length - unhandledCount }}</a-tag>
    </template>
    <template #toolbar>
      <a-checkbox v-model="showUnhandledOnly">仅未处理</a-checkbox>
    </template>
    <a-card class="section-card" :bordered="false" title="告警列表">
      <a-table :data="filtered" :pagination="{ pageSize: 8 }" row-key="id">
        <template #columns>
          <a-table-column title="手术间" data-index="room" :width="100" />
          <a-table-column title="患者" data-index="patientName" />
          <a-table-column title="告警类型" data-index="alertType" />
          <a-table-column title="严重程度" :width="100">
            <template #cell="{ record }">
              <a-tag :color="severityColor(record.severity)">{{ record.severity }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="时间" data-index="time" :width="80" />
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="record.handled ? 'green' : 'red'">{{ record.handled ? '已处理' : '未处理' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="120">
            <template #cell="{ record }">
              <a-button size="mini" type="primary" :disabled="record.handled" @click="handleAlert(record.id)">
                处理
              </a-button>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { MonitorAlert } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const showUnhandledOnly = ref(false);

const unhandledCount = computed(() => store.monitorAlerts.filter((item) => !item.handled).length);

const severityColor = (severity: MonitorAlert['severity']) => ({
  一般: 'arcoblue',
  严重: 'orangered',
  危急: 'red',
}[severity] ?? 'gray');

const filtered = computed(() => {
  if (!showUnhandledOnly.value) return store.monitorAlerts;
  return store.monitorAlerts.filter((item) => !item.handled);
});

const handleAlert = (id: string) => {
  const alert = store.monitorAlerts.find((item) => item.id === id);
  if (!alert || alert.handled) return;
  alert.handled = true;
  Message.success('告警已标记为已处理');
};
</script>

<template>
  <ModulePageShell title="设备数据采集" description="监护仪、麻醉机等多参数设备接入与同步状态">
    <template #toolbar>
      <a-select v-model="statusFilter" style="width: 120px" allow-clear placeholder="状态">
        <a-option value="在线">在线</a-option>
        <a-option value="离线">离线</a-option>
        <a-option value="告警">告警</a-option>
      </a-select>
    </template>
    <a-card class="section-card" :bordered="false" title="设备列表">
      <a-table :data="filtered" :pagination="{ pageSize: 10 }" row-key="id">
        <template #columns>
          <a-table-column title="设备名称" data-index="name" />
          <a-table-column title="手术间" data-index="room" :width="100" />
          <a-table-column title="类型" data-index="type" />
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="最近同步" data-index="lastSync" :width="120" />
        </template>
      </a-table>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { MonitorDevice } from '@/types/clinicalModules';

const store = useAnesthesiaStore();
const statusFilter = ref<string | undefined>();

const statusColor = (status: MonitorDevice['status']) => ({
  在线: 'green',
  离线: 'gray',
  告警: 'red',
}[status] ?? 'gray');

const filtered = computed(() => {
  if (!statusFilter.value) return store.monitorDevices;
  return store.monitorDevices.filter((item) => item.status === statusFilter.value);
});
</script>

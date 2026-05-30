<template>
  <ModulePageShell title="手术间实时大屏" description="各手术间监护设备在线状态与最近同步时间">
    <template #chips>
      <a-tag color="green">在线 {{ statusCount('在线') }}</a-tag>
      <a-tag color="red">告警 {{ statusCount('告警') }}</a-tag>
      <a-tag>离线 {{ statusCount('离线') }}</a-tag>
    </template>
    <template #stats>
      <MetricCard label="设备总数" :value="store.monitorDevices.length" icon="IconDesktop" />
      <MetricCard label="在线" :value="statusCount('在线')" icon="IconCheckCircle" />
      <MetricCard label="告警" :value="statusCount('告警')" icon="IconExclamationCircle" variant="warn" />
      <MetricCard label="未处理告警" :value="unhandledAlerts" icon="IconExclamationCircle" :variant="unhandledAlerts ? 'danger' : 'default'" />
    </template>
    <a-card class="section-card" :bordered="false" title="设备状态矩阵">
      <div class="device-grid">
        <div
          v-for="device in store.monitorDevices"
          :key="device.id"
          class="device-card"
          :class="`device-card--${deviceStatusClass(device.status)}`"
        >
          <div class="device-card__head">
            <strong>{{ device.name }}</strong>
            <a-tag :color="deviceStatusColor(device.status)" size="small">{{ device.status }}</a-tag>
          </div>
          <div class="device-card__room">{{ device.room }}</div>
          <div class="device-card__type">{{ device.type }}</div>
          <div class="device-card__sync">同步 {{ device.lastSync }}</div>
        </div>
      </div>
    </a-card>
  </ModulePageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MetricCard from '@/components/MetricCard.vue';
import ModulePageShell from '@/components/shared/ModulePageShell.vue';
import { useAnesthesiaStore } from '@/stores/anesthesia';
import type { MonitorDevice } from '@/types/clinicalModules';

const store = useAnesthesiaStore();

const statusCount = (status: MonitorDevice['status']) => store.monitorDevices.filter((item) => item.status === status).length;
const unhandledAlerts = computed(() => store.monitorAlerts.filter((item) => !item.handled).length);

const deviceStatusColor = (status: MonitorDevice['status']) => ({
  在线: 'green',
  离线: 'gray',
  告警: 'red',
}[status] ?? 'gray');

const deviceStatusClass = (status: MonitorDevice['status']) => ({
  在线: 'online',
  离线: 'offline',
  告警: 'alert',
}[status] ?? 'offline');
</script>

<style scoped>
.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
}
.device-card {
  padding: 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface-muted);
}
.device-card--online { background: rgb(220 252 231 / 50%); border-color: var(--color-success-100); }
.device-card--alert { background: rgb(254 242 242 / 80%); border-color: var(--color-danger-100); }
.device-card--offline { opacity: 0.75; }
.device-card__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.device-card__room { margin-top: 6px; font-weight: 600; font-size: var(--font-size-sm); }
.device-card__type { margin-top: 4px; font-size: var(--font-size-xs); color: var(--text-secondary); }
.device-card__sync { margin-top: 8px; font-size: var(--font-size-xs); color: var(--text-tertiary); }
</style>
